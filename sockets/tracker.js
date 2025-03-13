import {
    makeWASocket,
    fetchLatestBaileysVersion,
    DisconnectReason,
    useMultiFileAuthState,
    makeCacheableSignalKeyStore,
    proto, // Import proto for message handling
} from "@whiskeysockets/baileys";
import NodeCache from "node-cache";
import { logger } from "../Utils/Logger.js";
import { Store } from "../Utils/Store.js";
import { Config } from "../config.js";
import { Handler } from "../Message/Handler.js";
import { Print } from "../Libs/Print.js";
import { exec } from 'child_process';

// Initialize store
const store = Store(logger);

// Read session data from file
store?.readFromFile("./session.data.json");

// Save session data to file every 50 seconds
setInterval(() => {
    store?.writeToFile("./session.data.json");
}, 50_000);

// Auto restart every 50 minutes
setInterval(() => {
    console.log("Restarting the process...");
    sendRestartMessage().then(() => {
        exec('npm restart', (error, stdout, stderr) => {
            if (error) {
                console.error(`Error restarting: ${error.message}`);
                return;
            }
            if (stderr) {
                console.error(`Restart stderr: ${stderr}`);
                return;
            }
            console.log(`Restart output: ${stdout}`);
        });
    });
}, 50 * 60 * 1000); // 50 minutes in milliseconds

const msgRetryCounterCache = new NodeCache();
let sock; // Declare sock globally to access it in the exit handler

// Function to send restart message
async function sendRestartMessage() {
    if (!sock) {
        console.error("Socket is not initialized. Cannot send restart message.");
        return;
    }
    try {
        const time = new Intl.DateTimeFormat('en-US', {
            hour: 'numeric',
            minute: 'numeric',
            second: 'numeric',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            timeZone: 'Asia/Colombo'
        }).format(new Date());
        await sock.sendMessage('120363413673479593@g.us', 
                           { text: '●●● restarting yako 😕 ●●●\n> ' + time });
        console.log("Restart message sent successfully.");
    } catch (error) {
        console.error("Failed to send restart message:", error);
    }
}

// Monitor function to handle presence updates
async function monitor(sock) {
    const delay = millis => new Promise((resolve) => setTimeout(resolve, millis));

    await delay(3000);
    await sock.presenceSubscribe('94763068537@s.whatsapp.net');
    await delay(3000);
    await sock.presenceSubscribe('94727025657@s.whatsapp.net');
    await delay(3000);

    const time = new Intl.DateTimeFormat('en-US', {
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric',
        month: 'short',
        day: 'numeric',
        year: 'numeric',
        timeZone: 'Asia/Colombo'
    }).format(new Date());

    await sock.sendMessage('120363413673479593@g.us', { text: 'connected yako\n> ' + time });
    await delay(3000);
}

    sock.ev.process(async (ev) => {
        if (ev["creds.update"]) {
            await saveCreds();
        }
        if (ev["connection.update"]) {
            console.log("Connection update", ev["connection.update"]);
            const update = ev["connection.update"];
            const { connection, lastDisconnect } = update;
            if (connection === "close") {
                const shouldReconnect =
                    lastDisconnect.error?.output?.statusCode !== DisconnectReason.loggedOut;
                console.log(
                    "connection closed due to ",
                    lastDisconnect.error,
                    ", reconnecting ",
                    shouldReconnect
                );
                // Reconnect if not logged out
                if (shouldReconnect) {
                    connectToWhatsApp();
                }
            } else if (connection === "open") {
                console.log("opened connection");
                await monitor(sock); // Call monitor function
            }
        }
        if (ev["messages.upsert"]) {
            const { messages } = ev["messages.upsert"];
            for (const message of messages) {
                // Check if the message body is "!!restart"
                if (message.message?.conversation?.toLowerCase() === "!!restart") {
                    console.log("Restart command received. Restarting...");
                    await sock.sendMessage(message.key.remoteJid, { text: "Modayek wenna epa..😓" });
                    await sendRestartMessage(); // Send restart message before exiting
                    exec('npm restart', (error, stdout, stderr) => {
                        if (error) {
                            console.error(`Error restarting: ${error.message}`);
                            return;
                        }
                        console.log(`Restart output: ${stdout}`);
                    });
                }
            }
            Handler(ev["messages.upsert"], sock, store);
        }
        if (ev["presence.update"]) {
            const update = ev["presence.update"];
            const groupId = '120363413673479593@g.us';
            const { id, presences } = update;

            if (presences) {
                Object.entries(presences).forEach(async ([participant, presenceData]) => {
                    if (participant !== '94727025657@s.whatsapp.net' && participant !== '94763068537@s.whatsapp.net') {
                        return;
                    }

                    let participantName;
                    if (participant === '94727025657@s.whatsapp.net') {
                        participantName = '*Botakadaya 🐘*';
                    }
                    if (participant === '94763068537@s.whatsapp.net') {
                        participantName = '*Princess 👑*';
                    }

                    const { lastKnownPresence, lastSeen } = presenceData;
                    let message;

                    if (lastKnownPresence === 'available') {
                        const time = new Intl.DateTimeFormat('en-US', {
                            hour: 'numeric',
                            minute: 'numeric',
                            second: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            timeZone: 'Asia/Colombo'
                        }).format(new Date());
                        message = participantName + ' _is now_ *`ONLINE`*✅\n\n> ' + time;
                    } else if (lastKnownPresence === 'unavailable' && lastSeen) {
                        const lastSeenDate = new Date(lastSeen * 1000).toLocaleString('en-LK', {
                            timeZone: 'Asia/Colombo',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit',
                            second: '2-digit'
                        });

                        const time = new Intl.DateTimeFormat('en-US', {
                            hour: 'numeric',
                            minute: 'numeric',
                            second: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            timeZone: 'Asia/Colombo'
                        }).format(new Date());

                        message = participantName + ' _is now_ *`OFFLINE`*⭕\nlast seen at\n_' + lastSeenDate + '_\n\n> ' + time;
                    } else if (lastKnownPresence === 'unavailable' && lastSeen === undefined) {
                        const time = new Intl.DateTimeFormat('en-US', {
                            hour: 'numeric',
                            minute: 'numeric',
                            second: 'numeric',
                            month: 'short',
                            day: 'numeric',
                            year: 'numeric',
                            timeZone: 'Asia/Colombo'
                        }).format(new Date());

                        message = participantName + ' _is now_ *`OFFLINE`*⭕\n\n> ' + time;
                    } else {
                        return;
                    }

                    // Send message to the group
                    await sock.sendMessage(groupId, { text: message });
                });
            }
        }
    });

    // Function to load messages from store
    async function getMessage(key) {
        if (store) {
            const msg = await store.loadMessage(key.remoteJid, key.id);
            return msg?.message || undefined;
        }
        return proto.Message.fromObject({});
    }

    return sock;
}

export default connectToWhatsApp;
