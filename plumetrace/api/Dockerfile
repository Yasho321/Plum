# OWNER    : Yasho2
# DUE      : D1 16:00
# TASK     :
#   oven/bun:1 image + COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.x /lambda-adapter /opt/extensions/lambda-adapter; AWS_LWA_INVOKE_MODE=response_stream (for SSE); PORT=8080; CMD bun src/index.js. Build context repo root (needs contracts/).
# DONE WHEN: Tejas's ApiStack deploys it.
# GUIDE    : docs/team/YASHO2.md  |  brief: docs/PROJECT_BRIEF.md
# STATUS   : DONE
#
# Build context MUST be the repo root (the image needs ../contracts):
#   docker build -f api/Dockerfile -t plumetrace-api .

FROM oven/bun:1 AS base
WORKDIR /var/task

# Lambda Web Adapter extension. response_stream lets SSE flow through
# API Gateway / Function URL (brief §8.4, playbook §7).
COPY --from=public.ecr.aws/awsguru/aws-lambda-adapter:0.9.1 /lambda-adapter /opt/extensions/lambda-adapter
ENV AWS_LWA_INVOKE_MODE=response_stream
ENV PORT=8080
ENV NODE_ENV=production

# Install deps first (better layer caching). The API depends on file:../contracts.
COPY contracts/package.json ./contracts/package.json
COPY api/package.json ./api/package.json
COPY contracts ./contracts
RUN cd api && bun install

# App source
COPY api ./api

WORKDIR /var/task/api
EXPOSE 8080
CMD ["bun", "src/index.js"]
