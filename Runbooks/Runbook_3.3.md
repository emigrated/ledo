# Runbook 3.3 - Start Work Trigger (Expanded Skeleton)
- ## Objective
- Define the Start Work trigger contract and initial payload shape with concrete fields:
-  - action: start_work
-  - artifact_manifest: reference to artifact map / manifest
-  - timestamp: ISO 8601
-  - wave: numeric wave id
-  - region: numeric region id
-  - payload: opaque object with task references
-  - idempotency_key: string for replay protection
## Inputs
- Evidence Map references; Runbook 3.2 dependencies
## Steps
- Step 1: Define payload structure for Start Work (with concrete fields listed above)
- Step 2: Specify idempotency and replay protections (outline)
- Step 3: Map the payload fields to artifacts in the Evidence Map
- Step 4: Provide a sample payload payload for testing
## Outputs
- Start Work payload contract (expanded skeleton with field list)
## Verification
- Payload structure aligns with Runbooks and Evidence Map (with explicit fields)
- Define the Start Work trigger contract and initial payload shape with placeholders replaced by concrete structure where possible.
## Inputs
- Evidence Map references; Runbook 3.2 dependencies
## Steps
- Step 1: Define payload structure for Start Work (with concrete fields where known)
- Step 2: Specify idempotency and replay protections (outline)
## Outputs
- Start Work payload contract (expanded skeleton with field list)
## Verification
- Payload structure aligns with Runbooks and Evidence Map (with explicit fields)
