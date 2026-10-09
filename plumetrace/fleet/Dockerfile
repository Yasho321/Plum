# OWNER    : Khare (requested via HANDOFFS #19; drafted by Yasho2)
# TASK     :
#   Python container Lambda image for the fleet dose + re-planner functions.
#   Build context = repo root (needs fleet/ + contracts/python):
#     docker build -f fleet/Dockerfile -t plumetrace-fleet .
#   FleetStack overrides CMD per function:
#     dose      -> fleet.dose.handler.handler
#     replanner -> fleet.replanner.handler.handler
# STATUS   : DONE
FROM public.ecr.aws/lambda/python:3.12

# Python deps (ortools, scipy, h3, numpy, pandas, boto3, pydantic)
COPY fleet/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

# App code + the shared Pydantic contracts, both importable from LAMBDA_TASK_ROOT
COPY fleet/ ${LAMBDA_TASK_ROOT}/fleet/
COPY contracts/python/plumetrace_contracts/ ${LAMBDA_TASK_ROOT}/plumetrace_contracts/

# Default handler (FleetStack overrides CMD for the re-planner function)
CMD ["fleet.dose.handler.handler"]
