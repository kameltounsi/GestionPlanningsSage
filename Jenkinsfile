pipeline {
    agent any

    environment {
        COMPOSE_PROJECT_NAME = 'gestionplanning'
        VM_HOST = 'localhost'
        FRONTEND_URL = 'http://localhost:3000'
        BACKEND_URL = 'http://localhost:3001/api'

        POSTGRES_DB = 'plannings'
        POSTGRES_USER = 'postgres'
        POSTGRES_HOST_PORT = '5432'
        SPRING_DATASOURCE_URL = 'jdbc:postgresql://postgres:5432/plannings'
        SERVER_PORT = '3001'
        VITE_API_BASE_URL = '/api'
        SPRING_MAIL_HOST = 'smtp.gmail.com'
        SPRING_MAIL_PORT = '587'
        SPRING_MAIL_SMTP_AUTH = 'true'
        SPRING_MAIL_STARTTLS_ENABLE = 'true'
        SPRING_MAIL_STARTTLS_REQUIRED = 'true'
        APP_ACCOUNT_MAIL_ENABLED = 'true'
        APP_ALERT_MAIL_ENABLED = 'true'
        PROMETHEUS_PORT = '9090'
        GRAFANA_PORT = '3002'
        GRAFANA_ADMIN_USER = 'admin'
        SONARQUBE_PORT = '9000'
        SONAR_HOST_URL = 'http://sonarqube:9000'
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Verify Docker') {
            steps {
                sh '''
                    docker --version
                    docker compose version
                '''
            }
        }

        stage('Backend Tests') {
            steps {
                sh '''
                    cd backend
                    mvn -B clean test
                '''
            }
        }

        stage('Frontend Build') {
            steps {
                sh '''
                    cd frontend
                    npm ci
                    npm run build
                '''
            }
        }

        stage('Create Environment File') {
            steps {
                withCredentials([
                    string(credentialsId: 'gestion-planning-postgres-password', variable: 'POSTGRES_PASSWORD'),
                    string(credentialsId: 'gestion-planning-grafana-password', variable: 'GRAFANA_ADMIN_PASSWORD'),
                    string(credentialsId: 'gestion-planning-sonar-db-password', variable: 'SONAR_POSTGRES_PASSWORD'),
                    string(credentialsId: 'gestion-planning-cloudinary-name', variable: 'CLOUDINARY_CLOUD_NAME'),
                    string(credentialsId: 'gestion-planning-cloudinary-key', variable: 'CLOUDINARY_API_KEY'),
                    string(credentialsId: 'gestion-planning-cloudinary-secret', variable: 'CLOUDINARY_API_SECRET'),
                    string(credentialsId: 'gestion-planning-mail-username', variable: 'SPRING_MAIL_USERNAME'),
                    string(credentialsId: 'gestion-planning-mail-password', variable: 'SPRING_MAIL_PASSWORD')
                ]) {
                    sh '''
                        cat > .env <<EOF
POSTGRES_DB=${POSTGRES_DB}
POSTGRES_USER=${POSTGRES_USER}
POSTGRES_PASSWORD=${POSTGRES_PASSWORD}
POSTGRES_HOST_PORT=${POSTGRES_HOST_PORT}

SERVER_PORT=${SERVER_PORT}
APP_FRONTEND_URL=${FRONTEND_URL}
VITE_API_BASE_URL=${VITE_API_BASE_URL}
SPRING_DATASOURCE_URL=${SPRING_DATASOURCE_URL}

CLOUDINARY_CLOUD_NAME=${CLOUDINARY_CLOUD_NAME}
CLOUDINARY_API_KEY=${CLOUDINARY_API_KEY}
CLOUDINARY_API_SECRET=${CLOUDINARY_API_SECRET}

SPRING_MAIL_USERNAME=${SPRING_MAIL_USERNAME}
SPRING_MAIL_PASSWORD=${SPRING_MAIL_PASSWORD}
SPRING_MAIL_HOST=${SPRING_MAIL_HOST}
SPRING_MAIL_PORT=${SPRING_MAIL_PORT}
SPRING_MAIL_SMTP_AUTH=${SPRING_MAIL_SMTP_AUTH}
SPRING_MAIL_STARTTLS_ENABLE=${SPRING_MAIL_STARTTLS_ENABLE}
SPRING_MAIL_STARTTLS_REQUIRED=${SPRING_MAIL_STARTTLS_REQUIRED}
APP_ACCOUNT_MAIL_ENABLED=${APP_ACCOUNT_MAIL_ENABLED}
APP_ALERT_MAIL_ENABLED=${APP_ALERT_MAIL_ENABLED}

PROMETHEUS_PORT=${PROMETHEUS_PORT}
GRAFANA_PORT=${GRAFANA_PORT}
GRAFANA_ADMIN_USER=${GRAFANA_ADMIN_USER}
GRAFANA_ADMIN_PASSWORD=${GRAFANA_ADMIN_PASSWORD}

SONARQUBE_PORT=${SONARQUBE_PORT}
SONAR_POSTGRES_DB=sonarqube
SONAR_POSTGRES_USER=sonarqube
SONAR_POSTGRES_PASSWORD=${SONAR_POSTGRES_PASSWORD}
EOF
                    '''
                }
            }
        }

        stage('SonarQube Analysis') {
            steps {
                withCredentials([
                    string(credentialsId: 'gestion-planning-sonar-token', variable: 'SONAR_TOKEN')
                ]) {
                    sh '''
                        docker compose up -d sonar-db sonarqube

                        echo "Waiting for SonarQube..."
                        SONAR_READY=false
                        for i in $(seq 1 60); do
                            STATUS=$(curl -s http://localhost:${SONARQUBE_PORT}/api/system/status | sed -n 's/.*"status":"\\([^"]*\\)".*/\\1/p' || true)
                            if [ "$STATUS" = "UP" ]; then
                                SONAR_READY=true
                                break
                            fi

                            sleep 5
                        done

                        if [ "$SONAR_READY" != "true" ]; then
                            echo "SonarQube is not ready"
                            docker compose logs --tail=200 sonarqube
                            exit 1
                        fi

                        docker run --rm \
                            --network gestionplanning_default \
                            -v "$PWD:/usr/src" \
                            -w /usr/src \
                            sonarsource/sonar-scanner-cli:latest \
                            -Dsonar.host.url=${SONAR_HOST_URL} \
                            -Dsonar.token=${SONAR_TOKEN}
                    '''
                }
            }
        }

        stage('Build Images') {
            steps {
                sh '''
                    docker compose build --pull
                '''
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    docker compose up -d --remove-orphans
                '''
            }
        }

        stage('Health Check') {
            steps {
                sh '''
                    docker compose ps

                    echo "Waiting for backend..."
                    for i in $(seq 1 30); do
                        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" ${BACKEND_URL}/auth/me || true)
                        if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "401" ] || [ "$HTTP_CODE" = "403" ]; then
                            echo "Backend is reachable"
                            exit 0
                        fi

                        sleep 2
                    done

                    echo "Backend health check did not return success. Showing logs:"
                    docker compose logs --tail=120 backend
                    exit 1
                '''
            }
        }

        stage('Monitoring Check') {
            steps {
                sh '''
                    echo "Waiting for Prometheus metrics..."
                    METRICS_READY=false
                    for i in $(seq 1 30); do
                        HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:${SERVER_PORT}/actuator/prometheus || true)
                        if [ "$HTTP_CODE" = "200" ]; then
                            echo "Backend Prometheus metrics are available"
                            METRICS_READY=true
                            break
                        fi

                        sleep 2
                    done

                    if [ "$METRICS_READY" != "true" ]; then
                        echo "Backend Prometheus metrics are not available"
                        docker compose logs --tail=120 backend
                        exit 1
                    fi

                    echo "Checking Prometheus..."
                    curl -f http://localhost:${PROMETHEUS_PORT}/-/ready

                    echo "Checking Grafana..."
                    curl -f http://localhost:${GRAFANA_PORT}/api/health
                '''
            }
        }
    }

    post {
        success {
            echo "Deployment completed: ${FRONTEND_URL}"
            echo "Prometheus: http://localhost:${PROMETHEUS_PORT}"
            echo "Grafana: http://localhost:${GRAFANA_PORT}"
            echo "SonarQube: http://localhost:${SONARQUBE_PORT}"
        }

        failure {
            sh '''
                docker compose ps || true
                docker compose logs --tail=120 || true
            '''
        }

        always {
            sh '''
                docker image prune -f || true
            '''
        }
    }
}
