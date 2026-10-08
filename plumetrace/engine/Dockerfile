# OWNER    : Tejas
# DUE      : D1 15:00
# TASK     :
#   FROM public.ecr.aws/lambda/python:3.12; install eccodes (dnf or pip `eccodes` wheel with binary), requirements.txt, copy plumetrace_engine + contracts/python. Build context = repo root. Test cfgrib decode inside the image on D1 (risk §20).
# DONE WHEN: `docker run` decodes a GFS record inside the image.
# STATUS   : WIP  (image authored; `docker build`/run decode check pending a Docker host + a filled engine/requirements.txt — handoff #7)
# GUIDE    : docs/team/TEJAS.md  |  brief: docs/PROJECT_BRIEF.md
#
# Build from the REPO ROOT so both engine/ and contracts/python/ are in context:
#   docker build -f engine/Dockerfile -t plumetrace-engine .
# Smoke-test the eccodes/cfgrib stack (the #1 risk, §20) inside the image:
#   docker run --rm --entrypoint python plumetrace-engine -c \
#     "import cfgrib, eccodes; print('eccodes', eccodes.__version__); print('cfgrib ok')"
# Run an engine handler (one cmd per Step Functions state):
#   docker run --rm plumetrace-engine plumetrace_engine.handlers.ingest_gfs

FROM public.ecr.aws/lambda/python:3.12

# System build deps for the scientific stack. The `eccodes` PyPI wheel bundles the
# libeccodes binary, so cfgrib works without a separate dnf install; keep gcc for
# any source builds (h3, etc.).
RUN dnf install -y gcc gcc-c++ make tar gzip && dnf clean all

# Install Python deps first for layer caching. engine/requirements.txt is owned by
# Yasho1 (handoff #7); it must pin: numpy pandas pyarrow xarray netCDF4 cfgrib
# eccodes scipy h3>=4 lightgbm shapely scikit-learn boto3 requests pydantic>=2.
COPY engine/requirements.txt ./requirements.txt
RUN pip install --no-cache-dir -r requirements.txt

# App code: the engine package and the Python contract mirror.
COPY engine/plumetrace_engine ${LAMBDA_TASK_ROOT}/plumetrace_engine
COPY contracts/python/plumetrace_contracts ${LAMBDA_TASK_ROOT}/plumetrace_contracts

# Default handler; EngineStack overrides CMD per state
# (e.g. plumetrace_engine.handlers.ingest_firms, .back_trajectories, ...).
CMD ["plumetrace_engine.handlers.resolve_run"]
