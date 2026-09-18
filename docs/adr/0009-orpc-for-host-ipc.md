# oRPC for host IPC, not a hand-rolled rpc library

The renderer talks to the hosts through [oRPC](https://orpc.dev) (`@orpc/contract`, `@orpc/server`, `@orpc/client`). It runs over oRPC's MessagePort adapter, which accepts both the DOM `MessagePort` and Electron's `MessagePortMain`. Each host contract is an oRPC contract built from zod schemas. A request → response member is a procedure. A stream is a procedure whose output is an `eventIterator`. An event is a procedure with no input whose event iterator is fed by an `EventPublisher`.

oRPC already does everything SPEC §5.2 asked a hand-rolled library to do:
- It validates inputs before a handler runs, and validates outputs and declared errors before sending.
- It carries typed error codes and cancels a stream when the consumer stops iterating or aborts.
- It turns anything unexpected into a bare `INTERNAL_SERVER_ERROR`.

It does all this without any transport code of our own. `src/shared/rpc` keeps only `serve` and `connect`. They start the port and hand out safe clients.

## Considered Options

- **Hand-rolled library over a minimal channel** (the first drafts of #20 and #21): rejected. It meant about 500 lines of protocol, stream and cancellation code to own and test, all of which oRPC already provides.
- **tRPC v11**: rejected. Its Electron adapters use `ipcRenderer` rather than MessagePorts and haven't been updated since 2024–25, so we would write the transport ourselves.
- **birpc, Comlink**: rejected. Neither validates inputs or types errors, and ADR-0006 needs both because the renderer is the least-trusted peer.

## Consequences

- **Throwing at the boundary.** A handler signals a declared error by throwing `errors.CODE({ data })`. This is the one place where host code throws on purpose. The code underneath stays `Result`-based.
- **Errors carry their coded value.** Each declared error's `data` is the coded error itself, code included (for example `{ code: 'GIT_TOO_OLD', version }`).
  - `DeclaredError<M>` derives that union from a procedure's error map.
  - A handler turns a `Result` error into its declared code with `throw declaredError(errors, error)`.
  - The client reads `error.data` as the same coded union once `isDefinedError` has narrowed it.
- **Safe clients.** A call resolves to `{ error, data }` and never rejects.
  - A declared error arrives as an `ORPCError` with its code and its `data`, minus any fields the schema doesn't declare. `isDefinedError` narrows it.
  - The library's own codes are:
    - `BAD_REQUEST`: invalid input, with the validation issues attached
    - `NOT_FOUND`: a method the host doesn't serve
    - `INTERNAL_SERVER_ERROR`: anything unexpected
- **Stream and event failures reject the iterator** rather than arriving as values. That includes a declared error thrown by a stream handler.
- **Serialization.** Messages go through oRPC's RPC serializer rather than raw structured clone. Transfer lists are opt-in (`experimental_transfer`).
- **Reconnect.** Reconnecting and resubscribing after a host restart is still ours to build on top.
- **Platform rules.** oRPC runs in every process. Its core and the MessagePort adapter import nothing platform-specific, so dependency-cruiser's rules for `shared` still hold.
