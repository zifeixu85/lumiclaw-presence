# AgentTeams M0 isolated profile

This directory records the immutable image identity and fail-closed isolation contract used by SDD-000.

M0 verifies:

- AgentTeams `v1.2.0` image tags plus locally observed digests;
- an isolated CLI/version and adapter-contract smoke;
- a six-role topology contract with an orchestration-only Leader and an independent Auditor;
- rejection of host share, Docker socket, host-home mount, public Worker/Controller HostPort, real secret references, and missing health/resource/PID controls.

M0 does **not** claim a live LLM-backed AgentTeam run. That evidence belongs to M2. The controlled capability fixture is deliberately labeled `ADAPTER_CONTRACT_SMOKE`, and `liveAgentTeamRun` is always `false`.

Run `npm run check:runtime-profile` for schema/policy evidence. Run both pinned images and the controlled adapter fixture with:

```bash
npm run verify:agentteams-images
```

The project-scoped verifier runs both the manager and worker image probes, records `.evidence/sdd-000/agentteams-image-smoke.json`, and cleans its network/containers. The profile publishes no host port, mounts no host path or secret, and uses a private internal network. It calls a controlled version fixture only to prove the pinned AgentTeams CLI/image and adapter response contract; it does not start a Manager, Worker, or Mission.
