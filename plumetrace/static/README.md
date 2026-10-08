# README.md

> OWNER    : Khare
> DUE      : D1 14:00
> TASK     :
>   Record source + licence of districts.geojson (geoBoundaries IND ADM2 or DataMeet — VERIFY licence) and that chc_centres.geojson is SYNTHETIC (~30 points across hotspot districts) unless an open dataset is found within 2 h. Upload both to s3://<bucket>/static/.
> DONE WHEN: Yasho1 and Khare's report both read them.
> GUIDE    : docs/team/KHARE.md  |  brief: docs/PROJECT_BRIEF.md
> STATUS   : DONE

## Licences and Sources

- `districts.geojson`: Source is [geoBoundaries](https://www.geoboundaries.org) (IND ADM2). Licence: **CC BY 4.0**. Filtered to districts intersecting the Delhi-NCR / Punjab / Haryana / UP bounding box, and the `shapeName` property was copied to `district`.
- `chc_centres.geojson`: SYNTHETIC data representing ~30 machine-rental centres across hotspot districts. No real-world correlation.
