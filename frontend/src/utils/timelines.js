export function modificationTimelines(request) {
  if (Array.isArray(request?.timelines)) return request.timelines;
  return request?.timelineName ? [{ name: request.timelineName, comment: request.timelineComment || "" }] : [];
}
