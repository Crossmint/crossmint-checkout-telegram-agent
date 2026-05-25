"use client";

import { useCrossmintAuth, useWallet } from "@crossmint/client-sdk-react-ui";
import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import axios from 'axios';
import { Button } from "@/components/ui/button";
import { LogoutButton } from "@/components/LogoutButton";
import Image from "next/image";

// Helper to parse the state safely
function parseBotState(encodedState: string | null): { userId: number } | null {
    if (!encodedState) return null;
    try {
        const decodedJson = Buffer.from(encodedState, 'base64').toString('utf-8');
        const parsed = JSON.parse(decodedJson);
        if (parsed && typeof parsed.userId === 'number') {
            return { userId: parsed.userId };
        }
        return null;
    } catch (error) {
        console.error("Error parsing bot state:", error);
        return null;
    }
}


function HomeContent() {
  const { wallet, status: walletStatus } = useWallet();
  const { login, status: authStatus, user, jwt } = useCrossmintAuth();
  const router = useRouter();
  const searchParams = useSearchParams();

  const [botTelegramId, setBotTelegramId] = useState<number | null>(null);
  const [webhookStatus, setWebhookStatus] = useState<'idle' | 'pending' | 'success' | 'error'>('idle');
  const [hasNotifiedBot, setHasNotifiedBot] = useState(false);

  useEffect(() => {
    const encodedState = searchParams.get('state');
    const state = parseBotState(encodedState);
    if (state?.userId) {
        setBotTelegramId(state.userId);
        console.log(`Bot user ID found in URL: ${state.userId}`);
    }
  }, [searchParams]);

  useEffect(() => {
    // Only attempt to notify the bot if we haven't already and all conditions are met
    if (!hasNotifiedBot && authStatus === "logged-in" && walletStatus === "loaded") {
      if (user && wallet?.address && jwt && botTelegramId) {
          console.log("All data available (user, wallet, jwt, botId), attempting to notify bot...");
          setWebhookStatus('pending');
          setHasNotifiedBot(true); // Set to true immediately to prevent retries

          const payload = {
              userId: botTelegramId, 
              walletAddress: wallet.address,
              crossmintUserId: user.id, 
              email: user.email,         
              authToken: jwt,
          };

          axios.post('/api/webhook/wallet-created', payload)
              .then(response => {
                  console.log('Successfully notified bot', response.data);
                  setWebhookStatus('success');
              })
              .catch(error => {
                  console.error('Error notifying bot:', error);
                  setWebhookStatus('error');
              });
      }
    }
  }, [user, wallet, jwt, botTelegramId, authStatus, walletStatus, hasNotifiedBot]);

  const isLoading = authStatus === "initializing" || walletStatus === "in-progress";
  const isLoggedIn = user != null && wallet != null && authStatus === "logged-in" && walletStatus === "loaded";

  if (isLoading) {
      return (
          <div className="flex h-full w-full items-center justify-center">
              <div className="size-12 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          </div>
      );
  }

  if (!isLoggedIn) {
      return (
        <div className="flex flex-col items-center justify-center gap-6 text-center">
            <h1 className="text-4xl font-bold tracking-tight">Welcome</h1>
            <p className="max-w-md text-lg text-foreground/70">
                Sign in with your email to create a secure wallet and start using our services.
            </p>
            <Button size="lg" onClick={() => login()}>
                Sign In with Email
            </Button>
        </div>
      );
  }

  return (
    <div className="flex w-full max-w-md flex-col items-center gap-6 rounded-xl border bg-background p-8 shadow-lg">
        <h2 className="text-2xl font-semibold">Welcome, {user.email}!</h2>
        <div className="flex w-full flex-col gap-4 text-left">
            <div className="flex flex-col gap-1">
                <span className="text-sm text-foreground/70">Crossmint User ID</span>
                <p className="break-all font-mono text-sm">{user.id}</p>
            </div>
            <div className="flex flex-col gap-1">
                <span className="text-sm text-foreground/70">Your Wallet Address</span>
                <p className="break-all font-mono text-sm">{wallet.address}</p>
            </div>
        </div>
        <div className="flex w-full flex-col items-center gap-2 pt-4">
            {webhookStatus === 'success' && (
                <p className="text-sm text-green-600">Your wallet is now linked to the bot!</p>
            )}
            {webhookStatus === 'error' && (
                <p className="text-sm text-red-600">Could not link wallet to the bot. Please try again.</p>
            )}
            <Button size="lg" onClick={() => router.push("https://t.me/your_bot_username_here")}>
                Return to Bot
            </Button>
            <div className="pt-4">
                <LogoutButton />
            </div>
        </div>
    </div>
  );
}

// Main page component
export default function Home() {
    return (
        <div className="grid h-screen items-center">
            <main className="flex h-full flex-col items-center justify-center gap-8">
                <Suspense fallback={<div>Loading...</div>}>
                    <HomeContent />
                </Suspense>
            </main>
            <footer className="row-start-3 flex flex-col items-center justify-center gap-4 pb-4">
                <a href="https://www.crossmint.com" target="_blank" rel="noopener noreferrer">
                    <Image src="/crossmint-leaf.svg" alt="Crossmint Logo" width={152} height={20} />
                </a>
            </footer>
        </div>
    );
}
