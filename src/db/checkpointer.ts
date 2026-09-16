import { PostgresSaver } from "@langchain/langgraph-checkpoint-postgres";
import { pool } from "./client";

export const checkpointer = new PostgresSaver(pool);

export async function setupCheckpointer(): Promise<void> {
  await checkpointer.setup();
}
