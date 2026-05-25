"use client";

import { useEffect, useState } from "react";
import { useWallet } from "@crossmint/client-sdk-react-ui";

type DelegatedSigner = {
  signer: string;
};

function signerAddress(signer: unknown): string | null {
  if (typeof signer === "string") {
    return signer;
  }

  if (signer && typeof signer === "object") {
    const record = signer as Record<string, unknown>;
    return (
      (typeof record.signer === "string" && record.signer) ||
      (typeof record.address === "string" && record.address) ||
      (typeof record.locator === "string" && record.locator) ||
      null
    );
  }

  return null;
}

// Bot signer address from your environment
const BOT_SIGNER_ADDRESS = "0x9AF659Ef26583C0793c35C52E076FBeA6486E31d";

export function DelegationComponent() {
  const { wallet } = useWallet();
  
  const [isLoading, setIsLoading] = useState(false);
  const [permissions, setPermissions] = useState<DelegatedSigner[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch existing delegated signers
  const fetchPermissions = async () => {
    if (!wallet) return;
    
    try {
      const walletWithSigners = wallet as unknown as {
        delegatedSigners?: () => Promise<unknown[]>;
        signers?: () => Promise<unknown[]>;
      };
      const signers = walletWithSigners.delegatedSigners
        ? await walletWithSigners.delegatedSigners()
        : await walletWithSigners.signers?.();
      setPermissions(
        (signers ?? [])
          .map((signer) => signerAddress(signer))
          .filter((signer): signer is string => signer != null)
          .map((signer) => ({ signer }))
      );
      setError(null);
    } catch (err) {
      console.error("Error fetching delegated signers:", err);
      setError("Failed to load current permissions");
    }
  };

  useEffect(() => {
    fetchPermissions();
  }, [wallet]);

  const isBotDelegated = permissions.some(
    p => p.signer.toLowerCase() === BOT_SIGNER_ADDRESS.toLowerCase()
  );

  const addBotDelegation = async () => {
    if (!wallet) {
      setError("No wallet connected");
      return;
    }

    try {
      setIsLoading(true);
      setError(null);
      
      const walletWithSignerMutation = wallet as unknown as {
        addDelegatedSigner?: (params: { signer: string }) => Promise<unknown>;
        addSigner?: (params: { type: "external-wallet"; address: string }) => Promise<unknown>;
      };
      if (walletWithSignerMutation.addDelegatedSigner) {
        await walletWithSignerMutation.addDelegatedSigner({ signer: BOT_SIGNER_ADDRESS });
      } else if (walletWithSignerMutation.addSigner) {
        await walletWithSignerMutation.addSigner({
          type: "external-wallet",
          address: BOT_SIGNER_ADDRESS,
        });
      } else {
        throw new Error("Connected wallet does not expose delegated signer methods");
      }
      
      // Refresh permissions
      await fetchPermissions();
      
      // Notify bot about successful delegation
      const params = new URLSearchParams(window.location.search);
      const userId = params.get('userId');
      
      if (userId) {
        try {
          await fetch(`${process.env.NEXT_PUBLIC_BOT_API_URL}/api/webhook/delegation-completed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: parseInt(userId),
              botSigner: BOT_SIGNER_ADDRESS,
              status: 'success'
            })
          });
        } catch (webhookError) {
          console.warn("Failed to notify bot:", webhookError);
        }
      }
      
    } catch (err) {
      console.error("Error adding delegation:", err);
      const errorMessage = err instanceof Error ? err.message : String(err);
      
      // Check if error is "already delegated" - treat as success
      if (errorMessage.toLowerCase().includes('already') || 
          errorMessage.toLowerCase().includes('delegated')) {
        console.log("Bot signer already delegated - treating as success");
        await fetchPermissions(); // Refresh to show current state
      } else {
        setError(`Failed to add delegation: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Show success state if bot is already delegated
  if (isBotDelegated) {
    return (
      <div className="bg-white flex flex-col gap-4 rounded-xl border shadow-sm p-6">
        <div className="text-center">
          <div className="w-16 h-16 mx-auto mb-4 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-xl font-semibold text-green-800 mb-2">Fast Shopping Enabled!</h2>
          <p className="text-gray-600 mb-4">
            The bot can now automatically sign transactions for faster shopping.
          </p>
          <p className="text-sm text-gray-500">
            You can close this window and return to Telegram.
          </p>
        </div>
        
        {/* Show current delegated signers */}
        {permissions.length > 0 && (
          <div className="border-t pt-4">
            <h3 className="text-sm font-medium text-gray-700 mb-2">Current Delegated Signers:</h3>
            <div className="space-y-2">
              {permissions.map(({ signer }, index) => (
                <div key={index} className="bg-gray-50 rounded-lg p-3">
                  <p className="text-xs font-mono text-gray-600 break-all">{signer}</p>
                  {signer.toLowerCase() === BOT_SIGNER_ADDRESS.toLowerCase() && (
                    <span className="text-xs text-green-600 font-medium">✓ Bot Signer (Active)</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="bg-white flex flex-col gap-4 rounded-xl border shadow-sm p-6">
      <div>
        <h2 className="text-xl font-semibold mb-2">Enable Fast Shopping</h2>
        <p className="text-gray-600 mb-4">
          Allow the bot to automatically sign transactions for instant purchases without manual approval.
        </p>
        
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <h3 className="font-medium text-blue-800 mb-2">Benefits:</h3>
          <ul className="text-sm text-blue-700 space-y-1">
            <li>• Instant purchases without waiting</li>
            <li>• Seamless shopping experience</li>
            <li>• You can revoke anytime</li>
            <li>• Your wallet remains secure</li>
          </ul>
        </div>

        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <h3 className="font-medium text-gray-700 mb-2">Bot Signer Address:</h3>
          <p className="text-sm font-mono text-gray-600 break-all">{BOT_SIGNER_ADDRESS}</p>
        </div>
      </div>

      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-700 text-sm">{error}</p>
        </div>
      )}

      <button
        className={`w-full py-3 px-4 rounded-lg text-sm font-medium transition-colors ${
          isLoading
            ? "bg-gray-200 text-gray-500 cursor-not-allowed"
            : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
        onClick={addBotDelegation}
        disabled={isLoading}
      >
        {isLoading ? "Setting up delegation..." : "Enable Fast Shopping"}
      </button>

      {/* Show current delegated signers if any exist */}
      {permissions.length > 0 && (
        <div className="border-t pt-4">
          <h3 className="text-sm font-medium text-gray-700 mb-2">Current Delegated Signers:</h3>
          <div className="space-y-2">
            {permissions.map(({ signer }, index) => (
              <div key={index} className="bg-gray-50 rounded-lg p-3">
                <p className="text-xs font-mono text-gray-600 break-all">{signer}</p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
