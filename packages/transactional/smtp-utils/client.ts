import nodemailer from "nodemailer";

const host = process.env.SMTP_HOST;
const port = Number(process.env.SMTP_PORT || "587");
const user = process.env.SMTP_USER;
const pass = process.env.SMTP_PASS;

export const transporter = host && user && pass
	? nodemailer.createTransport({
			host,
			port,
			secure: port === 465,
			auth: { user, pass },
		})
	: undefined;
