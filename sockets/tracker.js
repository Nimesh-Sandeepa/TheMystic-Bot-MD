const { makeWASocket, useMultiFileAuthState, delay } = require('@adiwajshing/baileys');
const fs = require('fs');
const path = require('path');

// WhatsApp Group ID
const groupId = "120363413673479593@g.us"; // Replace with your WhatsApp group ID

// User details
const users = {
  "94705516233": "Botakadaya",
  "94727025657": "Harry"
};

async function connectToWhatsApp() {
  const { state, saveCreds } = await useMultiFileAuthState(path.join(__dirname, 'auth_info'));

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on('creds.update', saveCreds);

  sock.ev.on('connection.update', (update) => {
    const { connection, lastDisconnect } = update;
    if (connection === 'close') {
      if (lastDisconnect.error?.output?.statusCode !== 401) {
        connectToWhatsApp();
      }
    } else if (connection === 'open') {
      console.log('Connected to WhatsApp');
      sock.sendMessage(groupId, { text: 'connected ykoo' });
    }
  });

  sock.ev.on('presence.update', async ({ id, presences }) => {
    const userId = id.split('@')[0];
    if (users[userId]) {
      const username = users[userId];
      const presence = Object.keys(presences)[0];
      const lastSeen = presences[presence]?.lastKnownPresence?.lastSeen;

      if (presence === 'available') {
        await sock.sendMessage(groupId, { text: `${username} is ONLINE` });
      } else if (presence === 'unavailable') {
        if (lastSeen) {
          await sock.sendMessage(groupId, { text: `${username} is OFFLINE, Last Seen: ${new Date(lastSeen).toLocaleString()}` });
        } else {
          await sock.sendMessage(groupId, { text: `${username} is OFFLINE, Last Seen: Hidden` });
        }
      }
    }
  });
}

connectToWhatsApp();
