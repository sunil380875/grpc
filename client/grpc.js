const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const path = require("path");

// ── Load proto ────────────────────────────────────────────────────────────────
const PROTO_PATH = path.join(__dirname, "../proto/user.proto");

const packageDef = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true,
});
const proto = grpc.loadPackageDefinition(packageDef).user;

// ── Create gRPC client ────────────────────────────────────────────────────────
const SERVER_ADDR = process.env.GRPC_SERVER || "localhost:50051";

const client = new proto.UserService(
    SERVER_ADDR,
    grpc.credentials.createInsecure()
);


function startWatching() {
    const stream = client.WatchUser({ subscriber_id: "service-b" });
    let reconnecting = false;   // guard: fire reconnect only once per stream

    function tryReconnect(reason) {
        if (reconnecting) return;
        reconnecting = true;
        scheduleReconnect();
    }

    stream.on("data", (event) => {
        console.log("\n[Service B] ✅ Received UserEvent:");
        console.log(`  event     : ${event.event}`);
        console.log(`  id        : ${event.id}`);
        console.log(`  name      : ${event.name}`);
        console.log(`  email     : ${event.email}`);
        console.log(`  timestamp : ${event.timestamp}\n`);
    });

    stream.on("error", (err) => {
        if (err.code === grpc.status.CANCELLED) {
            tryReconnect("Stream cancelled by server");
        } else {
            console.error(`[Service B] ⚠️  Stream error (${err.code}): ${err.message}`);
            tryReconnect("Stream error");
        }
    });

    stream.on("end", () => {
        tryReconnect("Stream ended");
    });
}


function scheduleReconnect() {
    setTimeout(startWatching, process.env.RECONNECT_DELAY_MS);
}

// ── Start ─────────────────────────────────────────────────────────────────────
startWatching();

