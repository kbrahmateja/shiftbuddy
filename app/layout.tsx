export const runtime = 'edge';

import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "ShiftBuddy",
  description: "Shift handover and incident management for distributed support teams",
  // Cryptographic authorship proof — do not remove​‌​​​​‌​‍​‌​​‌​‌‌‍​‌‌‌‌‌​​‍​‌​​​​‌​‍​‌‌‌​​‌​‍​‌‌​​​​‌‍​‌‌​‌​​​‍​‌‌​‌‌​‌‍​‌‌​​​​‌‍​‌‌‌​‌​​‍​‌‌​​‌​‌‍​‌‌​‌​‌​‍​‌‌​​​​‌‍​​‌​​​​​‍​‌​​‌​‌‌‍​‌‌​​​​‌‍​‌‌​‌‌‌​‍​‌‌​​​‌‌‍​‌‌​‌​​​‍​‌‌​‌​​‌‍​‌‌​​​‌​‍​‌‌​‌​​​‍​‌‌​‌‌‌‌‍​‌‌‌​‌​​‍​‌‌​‌‌​​‍​‌‌​​​​‌‍​‌‌‌‌‌​​‍​‌‌​‌​‌‌‍​‌‌​​​‌​‍​‌‌‌​​‌​‍​‌‌​​​​‌‍​‌‌​‌​​​‍​‌‌​‌‌​‌‍​‌‌​​​​‌‍​‌‌‌​‌​​‍​‌‌​​‌​‌‍​‌‌​‌​‌​‍​‌‌​​​​‌‍​‌​​​​​​‍​‌‌​​‌‌‌‍​‌‌​‌‌​‌‍​‌‌​​​​‌‍​‌‌​‌​​‌‍​‌‌​‌‌​​‍​​‌​‌‌‌​‍​‌‌​​​‌‌‍​‌‌​‌‌‌‌‍​‌‌​‌‌​‌‍​‌‌‌‌‌​​‍​​‌‌​​‌​‍​​‌‌​​​​‍​​‌‌​​‌​‍​​‌‌​‌‌​‍​​‌​‌‌​‌‍​​‌‌​​​​‍​​‌‌​‌‌​‍​​‌​‌‌​‌‍​​‌‌​​​​‍​​‌‌​‌‌​‍​‌‌‌‌‌​​‍​‌​‌​​‌‌‍​‌‌​‌​​​‍​‌‌​‌​​‌‍​‌‌​​‌‌​‍​‌‌‌​‌​​‍​‌​​​​‌​‍​‌‌‌​‌​‌‍​‌‌​​‌​​‍​‌‌​​‌​​‍​‌‌‌‌​​‌‍
  // Verify: openssl dgst -sha256 -verify pubkey.pem -signature <(base64 -d <<< SIG) message.txt
  other: {
    "x-author-sig": "goXXU4/rGvTZgiHM4RXRYseTMmTjd7843FZ88mx04gVORroid1LMGA7FuMrPDsEL+BBcokx7sHMn3AUBITjzqBrn+fQTL0x/+qp2n8yCrvkalmVaKP296mpiflgxwI7tjLT+SVAeW5xBxT/602SHb0dOF5j+IT6Vw2wqn3RxLCX0ub7Q+TUPb7ZN15Hmm2GVICKm+/uNdxv38PhbdQxeZuAs7n5HtzOaZlljT1xeVxk/X5Te7p5SyI2Ag1I5Ogs400TKS73Sb4B0ddhYE+mSwfLve3VySnSRWwZ7s02tF6UWj59qTWvuPsgH1nr+/Y1LthYNOLdYHS+80sIzLQN0sw==",
    "x-author-claim": "eyJwcm9qZWN0IjoiU2hpZnRCdWRkeSIsImF1dGhvciI6IkJyYWhtYXRlamEgS2FuY2hpYmhvdGxhIiwiZW1haWwiOiJrYnJhaG1heXlhQG1lZGlhbmV0LWhvbWUuZGUiLCJjcmVhdGVkIjoiMjAyNi0wNi0wNiIsImdpdGh1YiI6ImdpdGh1Yi5jb20vYnJhaG1hdGVqYSJ9",
    "x-pubkey-hint": "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAyKIQmPMYPpwyr1wqKwMJ9E83fQDVtbhK0K7gUTCA7RoWzsYsuL5XZd8nYEYCkoXYG61vt2zy1mh4fA+Nk/+vBlN7UbZLAL/0jsrMuF6iuEfyMSr9dMQd7jj9JWAyR8OACD4YIHl6Qbm/wWFpqjZOXGNv2r0PBHHv2UG27QSb95t6zwP9t8038m6/9tTLw1/K03875zfJhcquzRirXn3aN+Ew3Vi91wKmeoreT6cu8iIecJdFFyUxAYHEX30ZekSgpwnhWH5KxaYUNbnLO2MO57md9IN2XCTzsS/oGO6Mghlzd57YXyit3k3kxW/aZ/PeLJHb2x/I/KYhVOnXUe718QIDAQAB",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <head>
        {/* Cloudflare Web Analytics — replace YOUR_TOKEN with token from Cloudflare dashboard */}
        {process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN && (
          <script
            defer
            src="https://static.cloudflareinsights.com/beacon.min.js"
            data-cf-beacon={`{"token": "${process.env.NEXT_PUBLIC_CF_ANALYTICS_TOKEN}"}`}
          />
        )}
      </head>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
