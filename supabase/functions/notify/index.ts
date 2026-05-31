type NotifyPayload = {
  userId: string;
  title: string;
  body: string;
  category: "Approvals" | "Requests" | "Damage" | "Returns";
  urgent?: boolean;
  email?: string;
  pushTokens?: string[];
};

export default async function handler(req: Request) {
  const payload = (await req.json()) as NotifyPayload;

  return Response.json({
    queued: true,
    notification: {
      userId: payload.userId,
      title: payload.title,
      body: payload.body,
      category: payload.category,
      urgent: Boolean(payload.urgent),
    },
    email: payload.email ? "queued" : "skipped",
    push: payload.pushTokens?.length ? "queued" : "skipped",
  });
}
