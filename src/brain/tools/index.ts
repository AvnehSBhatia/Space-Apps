// The list of every tool. Adding a tool means adding its file and one line here.

import type { ToolId } from "../../contracts";
import type { ToolModule } from "../core";
import { averager } from "./averager";
import { copycat } from "./copycat";
import { longMemory } from "./longMemory";
import { neurons } from "./neurons";
import { season } from "./season";
import { spotlight } from "./spotlight";
import { trend } from "./trend";

export const TOOLS: ToolModule[] = [copycat, averager, season, trend, longMemory, spotlight, neurons];

const BY_ID = new Map<ToolId, ToolModule>(TOOLS.map((tool) => [tool.info.id, tool]));

/** The module for a tool id. Unknown ids fall back to Copycat, so an old save never crashes. */
export function moduleOf(id: ToolId): ToolModule {
  return BY_ID.get(id) ?? copycat;
}
