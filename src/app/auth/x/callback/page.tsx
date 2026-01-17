"use client";

import { useEffect, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";

function XCallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<"processing" | "success" | "error">("processing");
  const [message, setMessage] = useState("Processing authentication...");

  useEffect(() => {
    const username = searchParams.get("username");
    const name = searchParams.get("name");
    const profileImage = searchParams.get("profile_image");
    const error = searchParams.get("error");

    // Send result to opener window via postMessage
    if (window.opener) {
      if (error) {
        window.opener.postMessage(
          {
            type: "x-auth-error",
            error,
          },
          window.location.origin
        );
        setStatus("error");
        setMessage(`Authentication failed: ${error}`);
      } else if (username) {
        window.opener.postMessage(
          {
            type: "x-auth-success",
            username,
            name,
            profileImage,
          },
          window.location.origin
        );
        setStatus("success");
        setMessage(`Signed in as @${username}`);
      } else {
        window.opener.postMessage(
          {
            type: "x-auth-error",
            error: "No username received",
          },
          window.location.origin
        );
        setStatus("error");
        setMessage("Authentication failed: No username received");
      }

      // Close popup after a brief delay
      setTimeout(() => {
        window.close();
      }, 1500);
    } else {
      // Not in a popup - redirect to home
      setStatus("error");
      setMessage("Redirecting to home...");
      setTimeout(() => {
        window.location.href = "/";
      }, 1000);
    }
  }, [searchParams]);

  return (
    <div className="mb-4">
      {status === "processing" && (
        <div className="w-8 h-8 border-4 border-bags-gold border-t-transparent rounded-full animate-spin mx-auto" />
      )}
      {status === "success" && (
        <div className="w-8 h-8 bg-bags-green mx-auto flex items-center justify-center">
          <span className="text-white font-bold">OK</span>
        </div>
      )}
      {status === "error" && (
        <div className="w-8 h-8 bg-bags-red mx-auto flex items-center justify-center">
          <span className="text-white font-bold">X</span>
        </div>
      )}
      <p className="font-pixel text-[10px] text-gray-300 mt-4">{message}</p>
      <p className="font-pixel text-[8px] text-gray-500 mt-2">
        This window will close automatically
      </p>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="mb-4">
      <div className="w-8 h-8 border-4 border-bags-gold border-t-transparent rounded-full animate-spin mx-auto" />
      <p className="font-pixel text-[10px] text-gray-300 mt-4">Processing authentication...</p>
      <p className="font-pixel text-[8px] text-gray-500 mt-2">
        This window will close automatically
      </p>
    </div>
  );
}

export default function XCallbackPage() {
  return (
    <div className="min-h-screen bg-bags-dark flex items-center justify-center">
      <div className="bg-bags-darker border-4 border-bags-gold p-8 max-w-md text-center">
        <Suspense fallback={<LoadingFallback />}>
          <XCallbackContent />
        </Suspense>
      </div>
    </div>
  );
}
