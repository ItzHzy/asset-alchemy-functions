const sendgrid = require("@sendgrid/mail");
// import sendgrid from "@sendgrid/mail";

const dayjs = require("dayjs");
// import dayjs from "dayjs";
const utc = require("dayjs/plugin/utc");
// import utc from "dayjs/plugin/utc.js";
const timezone = require("dayjs/plugin/timezone.js");
// import timezone from "dayjs/plugin/timezone.js";
const dotenv = require("dotenv");
// import dotenv from "dotenv";
const Sentry = require("@sentry/node");
// import Sentry from "@sentry/node";
const Firestore = require("@google-cloud/firestore");
// import Firestore from "@google-cloud/firestore";
const Functions = require("@google-cloud/functions-framework");

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

const sendAlertEmail = (sendTo, symbol, ruleName) => {
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
	return true;
};

Functions.http("sendAlert", (req, res) => {
	Sentry.withScope((scope) => {
		try {
			const { data } = req.body;

			const trigger = JSON.parse(data);

			const alertRef = firestore.collection("alerts").doc(trigger.id);

			alertRef.get().then((alertSnapshot) => {
				const alert = alertSnapshot.data();

				const userRef = firestore.collection("users").doc(alert.creator);

				userRef.get().then((userSnapshot) => {
					const user = userSnapshot.data();

					if (user.email) {
						sendAlertEmail(user.email, trigger.event, trigger.name);
					}
				});
			});
		} catch (err) {
			Sentry.captureException(err);
			console.log(err);
			res.send("Goodbye World :(");
		}
	});
});
