import { defineCommand } from "citty";

import { commentMedia } from "../comment-media";
import { runComments } from "../comments";

const subCommands = Object.fromEntries(
  ["list", "show", "add", "reply", "resolve", "reopen", "delete", "edit"].map(command => [
    command,
    defineCommand({
      meta: {
        description:
          command === "add"
            ? "Add a reviewer note on a prototype state"
            : `${command} review comments`,
      },
      args: {
        ...(command === "list"
          ? {}
          : {
              id: {
                type: "positional" as const,
                required: true,
                description: command === "add" ? "Prototype slug" : "Comment id",
              },
            }),
        slug: { type: "string" },
        spec: { type: "string" },
        state: { type: "string", description: "Prototype state (add)" },
        status: { type: "enum", options: ["open", "resolved", "all"], default: "open" },
        note: { type: "string" },
        message: { type: "string", description: "One-based message number" },
        author: { type: "enum", options: ["agent", "reviewer"], default: "agent" },
        json: { type: "boolean" },
      },
      run({ args }) {
        runComments(command, args.id, args);
      },
    }),
  ])
);

export default defineCommand({
  meta: { description: "Read and answer local review comments" },
  subCommands: {
    ...subCommands,
    attach: defineCommand({
      meta: { description: "Attach image files to a message" },
      args: {
        id: { type: "positional", required: true },
        file: { type: "positional", required: true },
        message: { type: "string" },
      },
      run: ({ args }) => commentMedia("attach", args.id, { ...args, files: args._.slice(1) }),
    }),
    detach: defineCommand({
      meta: { description: "Remove an image from a message" },
      args: {
        id: { type: "positional", required: true },
        attachment: { type: "positional", required: true },
      },
      run: ({ args }) => commentMedia("detach", args.id, args),
    }),
    attachments: defineCommand({
      meta: { description: "Download comment images" },
      args: {
        id: { type: "positional", required: true },
        out: { type: "string", required: true },
        json: { type: "boolean" },
      },
      run: ({ args }) => commentMedia("attachments", args.id, args),
    }),
  },
});
