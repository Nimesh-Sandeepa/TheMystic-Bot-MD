
// Initialize Express app
const app = express();
const PORT = 8000; // Port for the server

// Basic route
app.get('/', (req, res) => {
    res.send('owwata enna epa ykooo');
});

// Start the server
app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});

// Initialize the database
await db.initialize();

// Connect to WhatsApp
connectToWhatsApp().catch((err) => {
    console.error("Failed to start WhatsApp bot:", err);
});

// Cron job to reset user limits every 24 hours
db.users.cron.schedule(
    "0 0 0 * * *", // Run at midnight every day
    (users) => {
        for (const key in users) {
            const user = users[key];
            user.limit = 15; // Reset user limit to 15
        }
    },
    { timezone: Config.timezone ?? "Asia/Colombo" } // Use configured timezone or default to Asia/Colombo
);
