import Docker from "dockerode";
import { env } from "../../config/env";

export function getPodmanSocketPath(): string {
  if (env.PODMAN_SOCKET_PATH) {
    return env.PODMAN_SOCKET_PATH;
  }
  const uid = typeof process.getuid === "function" ? process.getuid() : 1000;
  return `/run/user/${uid}/podman/podman.sock`;
}

export function createPodmanClient(socketPath = getPodmanSocketPath()): Docker {
  return new Docker({ socketPath });
}
