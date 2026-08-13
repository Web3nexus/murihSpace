import { Link, Form, redirect, useActionData } from "react-router";
import type { ActionFunctionArgs } from "react-router";
import { Button } from "../../components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from "../../components/ui/card";
import { Input } from "../../components/ui/input";
import { Label } from "../../components/ui/label";
import { Shield } from "lucide-react";

import { getSession, commitSession } from "../../lib/session.server";

export async function action({ request }: ActionFunctionArgs) {
  const formData = await request.formData();
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const token = String(formData.get("token") ?? "");

  // Mock authentication logic against the backend
  if (email !== "admin@murihspace.com" || password !== "password123" || !token) {
    return { error: "Authentication failed. Invalid credentials or token." };
  }

  const session = await getSession(request.headers.get("Cookie"));
  session.set("user", { email, role: "admin" });

  const headers = new Headers();
  headers.append("Set-Cookie", await commitSession(session));
  
  return redirect("/secureads/moderation/creatives", { headers });
}

export default function SecureAdsLogin() {
  const actionData = useActionData<{ error?: string }>();

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50">
      <Card className="w-[400px] shadow-lg border-t-4 border-t-red-600">
        <Form method="post">
          <CardHeader className="text-center pb-2">
            <div className="mx-auto bg-red-100 p-3 rounded-full w-12 h-12 flex items-center justify-center mb-4">
              <Shield className="h-6 w-6 text-red-600" />
            </div>
            <CardTitle className="text-2xl font-bold tracking-tight">Staff Authentication</CardTitle>
            <CardDescription>Restricted access for MurihSpace operations.</CardDescription>
          </CardHeader>
          <CardContent className="grid gap-4 mt-4">
            {actionData?.error && (
              <div className="p-3 text-sm font-medium text-red-800 bg-red-100 rounded-md">
                {actionData.error}
              </div>
            )}
            <div className="grid gap-2">
              <Label htmlFor="email">Staff Email</Label>
              <Input id="email" name="email" type="email" placeholder="admin@murihspace.com" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="password">Password</Label>
              <Input id="password" name="password" type="password" required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="token">MFA Token</Label>
              <Input 
                id="token" 
                name="token" 
                type="text" 
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="000 000" 
                required 
              />
            </div>
          </CardContent>
          <CardFooter>
            <Button type="submit" className="w-full bg-red-600 hover:bg-red-700">
              Authenticate
            </Button>
          </CardFooter>
        </Form>
      </Card>
    </div>
  );
}
