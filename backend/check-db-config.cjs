require("dotenv").config({ override: true });

const value = process.env.DATABASE_URL;

if (!value) {
    console.log("DATABASE_URL is missing");
    process.exit(1);
}

try {
    const url = new URL(value);

    console.log("Database configuration:");
    console.log("Protocol:", url.protocol);
    console.log("Username:", url.username);
    console.log("Host:", url.hostname);
    console.log("Port:", url.port);
    console.log("Database:", url.pathname);
    console.log("Password present:", url.password.length > 0);
    console.log("Password length:", url.password.length);
    console.log("URL format: valid");
} catch (error) {
    console.log("Invalid DATABASE_URL format:", error.message);
}
