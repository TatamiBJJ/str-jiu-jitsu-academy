import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);

  const code = requestUrl.searchParams.get("code");

  if (!code) {
    return NextResponse.redirect(
      new URL(
        "/login?error=missing_code",
        requestUrl.origin
      )
    );
  }

  try {
    const supabase = await createClient();

    const { error: exchangeError } =
      await supabase.auth.exchangeCodeForSession(code);

    if (exchangeError) {
      return NextResponse.redirect(
        new URL(
          "/login?error=confirmation_failed",
          requestUrl.origin
        )
      );
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.redirect(
        new URL(
          "/login?error=auth_failed",
          requestUrl.origin
        )
      );
    }

    // Единая серверная маршрутизация по ролям.
    return NextResponse.redirect(
      new URL("/pending", requestUrl.origin)
    );

  } catch {
    return NextResponse.redirect(
      new URL(
        "/login?error=auth_failed",
        requestUrl.origin
      )
    );
  }
}