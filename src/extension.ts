import * as fs from "fs";
import * as path from "path";
import * as vscode from "vscode";
import { ExtensionContext, workspace } from "vscode";
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind,
} from "vscode-languageclient/node";

// #TODO different path for windows/unix?
// #Tip Install server with `cargo install tan`.

/// The Tan CLI executable name.
const TAN_CLI = "tan";

// #Tip Install server with `cargo install tan_lsp_server`.

/// The Tan LSP Server executable name.
const TAN_LSP_SERVER = "tan_lsp_server";

/// The name of the Tan REPL terminal.
const TAN_REPL_TERMINAL_NAME = "Tan REPL";

let client: LanguageClient;

function executableExists(name: string): boolean {
  const envPath = process.env["PATH"];

  if (!envPath) {
    return false;
  }

  return envPath.split(path.delimiter)
    .some((x) => fs.existsSync(path.resolve(x, name)));
}

// focusTextEditor:
// vscode.commands.executeCommand("workbench.action.focusActiveEditorGroup");

/**
 * Creates a new REPL process.
 */
function createREPLTerminal(): Thenable<vscode.Terminal> {
  const terminal = vscode.window.createTerminal(TAN_REPL_TERMINAL_NAME);
  terminal.sendText(TAN_CLI, true);

  return vscode.window.withProgress({
    location: vscode.ProgressLocation.Notification,
    title: "Opening Tan REPL...",
    cancellable: false,
  }, () => {
    return new Promise<vscode.Terminal>((resolve) => {
      terminal.show();
      resolve(terminal);
    });
  });
}

/**
 * Opens a terminal with a Tan REPL. If a REPL process is already spawned, it
 * is reused.
 */
function openREPLTerminal(): Thenable<vscode.Terminal> {
  let terminal =
    vscode.window.terminals.find((t) => t.name === TAN_REPL_TERMINAL_NAME) ??
      createREPLTerminal();

  return Promise.resolve(terminal).then((t) => {
    t.show();
    return t;
  });
}

/** Activates the extension. */
export function activate(context: ExtensionContext) {
  // Logs client messages to Output > Tan Language Client
  const clientOutputChannel = vscode.window.createOutputChannel(
    "Tan Language Client",
  );
  clientOutputChannel.show(true);

  // Logs server messages to Output > Tab Language Server Trace
  const serverTraceOutputChannel = vscode.window.createOutputChannel(
    "Tan Language Server Trace",
  );

  // #Insight
  // Server output (eprintln!) is logged to Output > Tan Language

  // #TODO consider other TransportKinds?

  // #TODO make logging level a client option?

  // Control server logging level.
  const env = Object.assign({}, process.env);
  Object.assign(env, { RA_LOG: "trace" });

  const serverOptions: ServerOptions = {
    run: {
      command: TAN_LSP_SERVER,
      transport: TransportKind.stdio,
      options: { env },
    },
    debug: {
      command: TAN_LSP_SERVER,
      transport: TransportKind.stdio,
      options: { env },
    },
  };

  const clientOptions: LanguageClientOptions = {
    documentSelector: [{ scheme: "file", language: "tan" }],
    traceOutputChannel: serverTraceOutputChannel,
    synchronize: {
      fileEvents: workspace.createFileSystemWatcher("**/*.tan"),
    },
  };

  context.subscriptions.push(vscode.commands.registerCommand(
    "tan.openREPL",
    () => {
      clientOutputChannel.appendLine("Open REPL");
      openREPLTerminal();
    },
  ));

  context.subscriptions.push(
    vscode.commands.registerCommand("tan.syntaxTree", (args) => {
      // #TODO
    }),
  );

  client = new LanguageClient(
    "tan",
    "Tan Language",
    serverOptions,
    clientOptions,
  );

  client.start();
}

/** Deactivates the extension. */
export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }

  return client.stop();
}
