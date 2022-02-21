import sendgrid from "@sendgrid/mail";
import dayjs from "dayjs";
import utc from "dayjs/plugin/utc.js";
import timezone from "dayjs/plugin/timezone.js";
import dotenv from "dotenv";
import Sentry from "@sentry/node";
import Firestore from "@google-cloud/firestore";

dotenv.config();

Sentry.init({
	dsn: process.env.NODE_ENV != "development" ? process.env.SENTRY_DSN : "",
});

let firestore;

try {
	firestore = new Firestore({
		projectId: process.env.PROJECT_ID,
	});

	dayjs.extend(utc);
	dayjs.extend(timezone);

	sendgrid.setApiKey(process.env.SENDGRID_API_KEY);
} catch (err) {
	Sentry.captureException(err);
}

export function sendAlertEmail(sendTo, symbol, ruleName) {
	const now = dayjs().tz("America/New_York");

	const msg = {
		from: "alerts@assetalchemy.io",
		to: sendTo,
		dynamic_template_data: {
			symbol: symbol,
			ruleName: ruleName,
			day: now.format("MMM D, YYYY"),
			time: now.format("h:mm A EST"),
		},
		template_id: process.env.EMAIL_TEMPLATE_ID,
	};

	sendgrid.send(msg);
}

const sendAlert = (req, res) => {
	try {
		const alertRef = firestore.collection("alerts").doc(req.body.data.id);
		const alert = alertRef.get();
		const userRef = firestore.collection("users").doc(alert.creator);
		const user = userRef.get();

		if (alert.email) {
			sendAlertEmail(user.email, req.body.data.event, req.body.data.name);
		}

		res.status(200);
	} catch (err) {
		Sentry.captureException(err);
	}
};

export default sendAlert;
