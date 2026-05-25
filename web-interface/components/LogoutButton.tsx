"use client";

import { useCrossmintAuth } from "@crossmint/client-sdk-react-ui";
import { useSearchParams, useRouter } from 'next/navigation';
import { useState } from 'react';
import axios from 'axios';
import { Button } from "@/components/ui/button";

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

export function LogoutButton() {
  const { logout } = useCrossmintAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const handleLogout = async () => {
    if (isLoggingOut) return;
    
    setIsLoggingOut(true);
    
    try {
      // Get user ID from URL state if available
      const stateParam = searchParams.get('state');
      const state = parseBotState(stateParam);
      
      // First, notify our backend about the logout
      if (state?.userId) {
        try {
          await axios.post('/api/webhook/logout', {
            userId: state.userId,
            source: 'web'
          });
          console.log(`✅ Bot notified of web logout for user ${state.userId}`);
        } catch (error) {
          console.error('❌ Failed to notify bot of logout:', error);
          // Continue with logout even if notification fails
        }
      }
      
      // Then logout from Crossmint
      await logout();
      
      console.log('✅ Logged out successfully from web interface');
      
      // Redirect to a logged out state or close window
      router.push('/logged-out');
      
    } catch (error) {
      console.error('❌ Error during logout:', error);
    } finally {
      setIsLoggingOut(false);
    }
  };

  return (
    <Button
      onClick={handleLogout}
      disabled={isLoggingOut}
      variant="outline"
      className="w-full"
    >
      {isLoggingOut ? 'Logging out...' : 'Log out'}
    </Button>
  );
}
