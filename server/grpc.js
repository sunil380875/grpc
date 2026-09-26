const path = require("path");
const grpc = require("@grpc/grpc-js");
const protoLoader = require("@grpc/proto-loader");
const { getUser, getUserById, userEvents } = require("./server");

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

// ── RPC: GetUser (unary) ──────────────────────────────────────────────────────
function GetUser(call, callback) {
    const { id } = call.request;
    const user = getUserById(id);
    if (!user) {
        return callback(null, {
            id: 0,
            name: "",
            email: "",
            success: false,
            message: `No user found with id=${id}`,
        });
    }

    console.log(`[Service A] ✓ GetUser → ${JSON.stringify(user)}`);
    callback(null, {
        ...user,
        success: true,
        message: "User fetched successfully",
    });
}


function WatchUser(call) {
    const subscriberId = call.request.subscriber_id || "anonymous";
    console.log(`[Service A] 📡 New watch subscriber: "${subscriberId}"`);

    // Handler: push a UserEvent to this stream whenever a user is created
    function onUserCreated(user) {
        const event = {
            id: user.id,
            name: user.name,
            email: user.email,
            event: "USER_CREATED",
            timestamp: new Date().toISOString(),
        };
        console.log(`[Service A] 🚀 Pushing event to "${subscriberId}":`, event);
        try {
            call.write(event);
        } catch (err) {
            console.error(`[Service A] Failed to write to stream for "${subscriberId}":`, err.message);
        }
    }

    userEvents.on("user:created", onUserCreated);

    // Cleanup when the client disconnects
    call.on("cancelled", () => {
        console.log(`[Service A] ❌ Subscriber "${subscriberId}" disconnected`);
        userEvents.off("user:created", onUserCreated);
    });

    call.on("error", (err) => {
        console.error(`[Service A] Stream error for "${subscriberId}":`, err.message);
        userEvents.off("user:created", onUserCreated);
    });

    // Note: we intentionally do NOT call call.end() — stream stays open forever
}

function ValidateUser(call, callback) {
    const { id, name, email, error_info } = call.request;
    console.log(`[Service A] 🔍 ValidateUser → id=${id}, error_info="${error_info}"`);

    // Basic validation
    const valid = Boolean(id && name && email);
    callback(null, {
        valid,
        id,
        name,
        email,
        message: valid ? "Data looks correct" : "Missing required fields",
    });
}

// ── gRPC Server ───────────────────────────────────────────────────────────────
const server = new grpc.Server();

server.addService(proto.UserService.service, {
    GetUser,
    WatchUser,
    ValidateUser,
});

const GRPC_PORT = process.env.GRPC_PORT || 50051;

server.bindAsync(
    `0.0.0.0:${GRPC_PORT}`,
    grpc.ServerCredentials.createInsecure(),
    (err, port) => {
        if (err) {
            console.error("[Service A] gRPC Server error:", err);
            return;
        }
        console.log(`[Service A] ⚡ gRPC Server running on port ${port}`);
        console.log(`[Service A]    Waiting for Service B to subscribe...\n`);
    }
);
