import { redirect } from "react-router";
import { useEffect } from "react";
import { getWebClientUrl } from "~/lib/env";

export function loader() {
  return redirect(getWebClientUrl());
}

export default function WebClientRedirect() {
  const target = getWebClientUrl();

  useEffect(() => {
    window.location.replace(target);
  }, [target]);

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center p-6 text-center">
      <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#2164B6] border-t-transparent mb-4" />
      <h1 className="text-xl font-bold text-[#102840]">Connecting to MurihSpace Web Client</h1>
      <p className="text-sm text-[#5A7184] mt-2 max-w-md">
        Redirecting you to the MurihSpace web application. If you are not redirected automatically,{" "}
        <a href={target} className="text-[#2164B6] underline font-semibold hover:text-[#1b52a0]">
          click here to open
        </a>.
      </p>
    </div>
  );
}
