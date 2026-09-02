import http from "k6/http";
import { check, sleep } from "k6";
import { Rate } from "k6/metrics";

const BASE_URL = (__ENV.BASE_URL || "http://192.168.1.117:3000").replace(/\/$/, "");
const EMAIL = __ENV.TEST_EMAIL;
const PASSWORD = __ENV.TEST_PASSWORD;
const MAX_VUS = Math.min(Number(__ENV.MAX_VUS || 100), 1000);

if (!EMAIL || !PASSWORD) {
  throw new Error("TEST_EMAIL et TEST_PASSWORD sont obligatoires (compte de test uniquement).");
}

const applicationErrors = new Rate("application_errors");

export const options = {
  scenarios: {
    capacity: {
      executor: "ramping-vus",
      startVUs: 0,
      stages: [
        { duration: __ENV.RAMP_1 || "1m", target: Math.max(1, Math.round(MAX_VUS * 0.1)) },
        { duration: __ENV.HOLD_1 || "2m", target: Math.max(1, Math.round(MAX_VUS * 0.1)) },
        { duration: __ENV.RAMP_2 || "2m", target: Math.max(1, Math.round(MAX_VUS * 0.5)) },
        { duration: __ENV.HOLD_2 || "3m", target: Math.max(1, Math.round(MAX_VUS * 0.5)) },
        { duration: __ENV.RAMP_3 || "2m", target: MAX_VUS },
        { duration: __ENV.HOLD_3 || "5m", target: MAX_VUS },
        { duration: __ENV.RAMP_DOWN || "1m", target: 0 },
      ],
      gracefulRampDown: "30s",
    },
  },
  thresholds: {
    http_req_failed: [{ threshold: "rate<0.01", abortOnFail: true, delayAbortEval: "30s" }],
    application_errors: [{ threshold: "rate<0.01", abortOnFail: true, delayAbortEval: "30s" }],
    http_req_duration: ["p(95)<2000", "p(99)<5000"],
  },
};

export function setup() {
  const home = http.get(`${BASE_URL}/`, { tags: { endpoint: "home" } });
  if (!check(home, { "site accessible": (r) => r.status === 200 })) {
    throw new Error(`Site inaccessible: HTTP ${home.status}`);
  }
}

export default function () {
  const login = http.post(
    `${BASE_URL}/api/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { "Content-Type": "application/json" }, tags: { endpoint: "login" } },
  );

  const loginOk = check(login, {
    "connexion HTTP 200": (r) => r.status === 200,
    "token reçu": (r) => Boolean(r.json("token")),
  });
  applicationErrors.add(!loginOk);
  if (!loginOk) {
    sleep(1);
    return;
  }

  const headers = { Authorization: `Bearer ${login.json("token")}` };
  const responses = http.batch([
    ["GET", `${BASE_URL}/api/auth/me`, null, { headers, tags: { endpoint: "me" } }],
    ["GET", `${BASE_URL}/api/ecr-requests`, null, { headers, tags: { endpoint: "ecr_requests" } }],
    ["GET", `${BASE_URL}/api/dashboard/actions`, null, { headers, tags: { endpoint: "dashboard_actions" } }],
  ]);

  for (const response of responses) {
    const ok = check(response, { "lecture réussie": (r) => r.status === 200 });
    applicationErrors.add(!ok);
  }

  sleep(Number(__ENV.THINK_TIME || 3));
}

