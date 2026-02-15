import { NextResponse } from 'next/server';

const API_TOKEN = "1997|0cqO0COunscpPJBOiHHjJtpi5mODfElhyvIkOEcf5803240e"; // Ideally from env
const SENDER_ID = "TextLKDemo"; // Or "MindGuard" if registered

interface SMSData {
    recipient: string;
    message: string;
    schedule_time?: string;
}

export async function sendSMS(recipient: string, message: string) {
    // Format number: remove non-digits
    let cleanNumber = recipient.replace(/\D/g, '');

    // Ensure 94 prefix (if starts with 0, replace with 94; if no prefix, add 94)
    if (cleanNumber.startsWith('0')) {
        cleanNumber = '94' + cleanNumber.substring(1);
    } else if (!cleanNumber.startsWith('94')) {
        cleanNumber = '94' + cleanNumber;
    }

    const payload = {
        recipient: cleanNumber,
        sender_id: SENDER_ID,
        type: "plain",
        message: message
    };

    console.log("📨 Sending SMS to:", cleanNumber, "Message:", message);

    try {
        const response = await fetch("https://app.text.lk/api/v3/sms/send", {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${API_TOKEN}`,
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            body: JSON.stringify(payload)
        });

        const data = await response.json();
        console.log("✅ SMS API Response:", data);

        if (data.status === "success") {
            return true;
        } else {
            console.error("❌ SMS Failed:", data.message);
            return false;
        }
    } catch (error) {
        console.error("❌ SMS Network Error:", error);
        return false;
    }
}
