"use client";

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  CrossmintEmbeddedCheckout, 
  useCrossmintCheckout,
  CrossmintCheckoutProvider,
  CrossmintProvider,
  useCrossmintAuth
} from '@crossmint/client-sdk-react-ui';
import { Button } from '@/components/ui/button';
import axios from 'axios';

// Environment configuration (exactly matching fintech-starter-app)
const USDC_MINT = process.env.NEXT_PUBLIC_USDC_MINT;
const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID;
const CLIENT_API_KEY = process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY;

// Token locator (EXACT format from fintech-starter-app)
const USDC_LOCATOR = `${CHAIN_ID}:${USDC_MINT}${CHAIN_ID === "solana" ? "" : `:${USDC_MINT}`}`;

// Max amount allowed
const MAX_AMOUNT = 50;

// Debug logging very carefully
console.log('Topup Token Configuration:', {
  CHAIN_ID,
  USDC_MINT,
  USDC_LOCATOR,
  CLIENT_API_KEY: CLIENT_API_KEY ? 'Set' : 'Missing',
  note: 'Using corrected EVM format: chain:contractAddress'
});

// Helper to parse the state safely
function parseBotState(encodedState: string | null): { 
  userId: number, 
  walletAddress?: string,
  crossmintUserId?: string,
  email?: string,
  authToken?: string
} | null {
    if (!encodedState) return null;
    try {
        const decodedJson = Buffer.from(encodedState, 'base64').toString('utf-8');
        const parsed = JSON.parse(decodedJson);
        if (parsed && typeof parsed.userId === 'number') {
            return { 
              userId: parsed.userId,
              walletAddress: typeof parsed.walletAddress === 'string' ? parsed.walletAddress : undefined,
              crossmintUserId: typeof parsed.crossmintUserId === 'string' ? parsed.crossmintUserId : undefined,
              email: typeof parsed.email === 'string' ? parsed.email : undefined,
              authToken: typeof parsed.authToken === 'string' ? parsed.authToken : undefined
            };
        }
        return null;
    } catch (error) {
        console.error("Failed to parse state from URL.", error);
        return null;
    }
}

// Get BOT API URL
const BOT_API_URL = process.env.NEXT_PUBLIC_BOT_API_URL;

// Checkout appearance (exactly from fintech-starter-app)
const CHECKOUT_APPEARANCE = {
  rules: {
    Label: {
      font: {
        family: "Inter, sans-serif",
        size: "14px",
        weight: "500",
      },
      colors: {
        text: "#374151",
      },
    },
    Input: {
      borderRadius: "8px",
      font: {
        family: "Inter, sans-serif",
        size: "16px",
        weight: "400",
      },
      colors: {
        text: "#000000",
        background: "#FFFFFF",
        border: "#E0E0E0",
        boxShadow: "none",
        placeholder: "#999999",
      },
      hover: {
        colors: {
          border: "#0074D9",
        },
      },
      focus: {
        colors: {
          border: "#0074D9",
          boxShadow: "none",
        },
      },
    },
    PrimaryButton: {
      font: {
        family: "Inter, sans-serif",
      },
      colors: {
        background: "#30d55d",
      },
      hover: {
        colors: {
          background: "#26a64b",
        },
      },
      disabled: {
        colors: {
          background: "#F1F5F9",
        },
      },
    },
    DestinationInput: {
      display: "hidden",
    },
    ReceiptEmailInput: {
      display: "hidden",
    },
  },
  variables: {
    colors: {
      accent: "#30d55d",
    },
  },
} as const;

// Amount Input Component (exactly from fintech-starter-app)
function AmountInput({ amount, onChange }: { amount: string, onChange: (value: string) => void }) {
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value
      .replace("$", "")
      .replace(",", ".")
      .replace(/[^0-9.]/g, "");
    if (value.split(".").length > 2) return;
    if (value.split(".")[1]?.length > 2) return;

      onChange(value);
  };

  return (
      <input
      placeholder="$0.00"
      className="mb-1 w-full border-none text-center text-[54px] font-bold outline-none focus:ring-0"
      value={amount ? `$${amount}` : ""}
        onChange={handleChange}
      style={{ maxWidth: 200 }}
    />
  );
}

// Testing Card Modal (from fintech-starter-app)
function TestingCardModal() {
  return (
    <div className="fixed top-6 z-20 w-[calc(100%-32px)] space-y-3 rounded-3xl bg-white p-5 shadow-md lg:right-6 lg:w-[419px]">
      <div className="flex items-center gap-5 text-lg font-medium">
        <span>🧪 Test payments</span>
      </div>
      <p className="hidden text-gray-500 lg:block">
        Use the following test card to complete your payment
      </p>
      <div>
        <div className="w-full">
          <div className="flex items-center justify-between gap-2 rounded-md border py-1 pl-3 pr-1 shadow-sm">
            <span className="truncate text-sm">4242 4242 4242 4242</span>
            <button className="rounded-md border px-4 py-2 text-xs font-medium transition">
              Test Card
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// Checkout Component (exactly from fintech-starter-app)
function Checkout({ 
  amount, 
  walletAddress, 
  onPaymentCompleted, 
  receiptEmail, 
  onProcessingPayment,
  isAmountValid,
  step,
  goBack
}: { 
  amount: string, 
  walletAddress: string, 
  onPaymentCompleted: () => void,
  receiptEmail: string,
  onProcessingPayment: () => void,
  isAmountValid: boolean,
  step: "options" | "processing" | "completed",
  goBack: () => void
}) {
  const { order } = useCrossmintCheckout();
  console.log("order", order);

  useEffect(() => {
    // Enhanced completion detection with better logging
    console.log("Order state changed:", {
      phase: order?.phase,
      status: order?.payment?.status,
      lineItems: order?.lineItems?.[0]?.quote?.status,
      fullOrder: order
    });

    if (order?.phase === "completed") {
      console.log("✅ Payment completed - transitioning to success");
      onPaymentCompleted();
    }
    if (order?.phase === "delivery") {
      console.log("🔄 Payment processing - showing processing state");
      onProcessingPayment();
    }
  }, [order, onPaymentCompleted, onProcessingPayment]);

  // Separate effect for robust completion polling
  useEffect(() => {
    if (!order || step !== 'processing') return;

    console.log("Setting up completion polling for processing state");
    
    // Poll every 2 seconds to check for completion
    const pollInterval = setInterval(() => {
      console.log("Polling for completion:", {
        phase: order?.phase,
        step: step,
        hasOrder: !!order
      });
      
      // Check multiple completion conditions
      if (order?.phase === "completed") {
        console.log("✅ Polling detected completion");
        clearInterval(pollInterval);
        onPaymentCompleted();
      }
    }, 2000);

    // Also set a fallback timeout to force completion after 15 seconds
    const fallbackTimeout = setTimeout(() => {
      console.log("⏰ Fallback timeout - forcing completion after 15 seconds");
      clearInterval(pollInterval);
      onPaymentCompleted();
    }, 15000);

    return () => {
      clearInterval(pollInterval);
      clearTimeout(fallbackTimeout);
    };
  }, [order, step, onPaymentCompleted]);

  // @ts-ignore - Library types are incorrect, "requires-kyc" is a valid status
  const requiresKYC = order?.payment.status === "requires-kyc";

  return (
    <div className={`w-full flex-grow space-y-4 ${step !== "options" ? "flex items-center justify-center" : ""}`}>
      {amount && isAmountValid && (
        <div className={requiresKYC ? "fixed left-0 top-0 z-30 !mt-0 h-screen w-full items-center justify-center overflow-x-auto bg-white lg:relative lg:block lg:h-auto" : ""}>
          <div className={requiresKYC ? "w-100 flex h-full items-end" : ""}>
            {requiresKYC && (
              <button onClick={goBack} className="absolute left-5 top-5 z-40 lg:hidden">
                ←
              </button>
            )}
      <CrossmintEmbeddedCheckout
              recipient={{ walletAddress }}
              lineItems={{
            tokenLocator: USDC_LOCATOR,
            executionParameters: {
                mode: "exact-in",
                amount: amount || "0.00",
                maxSlippageBps: "500",
            },
              }}
        payment={{
          crypto: { enabled: false },
                fiat: {
                  enabled: true,
                  allowedMethods: {
                    card: true,
                    applePay: false,
                    googlePay: false,
                  },
                },
                receiptEmail,
        }}
              appearance={CHECKOUT_APPEARANCE}
      />
          </div>
        </div>
      )}
    </div>
  );
}

// Main TopUp Component
function TopUpPage() {
  const searchParams = useSearchParams();
  const { user } = useCrossmintAuth();
  const [userId, setUserId] = useState<number | null>(null);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [crossmintUserId, setCrossmintUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [amount, setAmount] = useState('');
  const [step, setStep] = useState<'options' | 'processing' | 'completed'>('options');
  
  // Initialize user data from URL state
  useEffect(() => {
    const stateParam = searchParams.get('state');
    
    if (!stateParam) {
      console.error("No state parameter found in URL");
      setError('Missing user identification. Please return to Telegram and use the /topup command again.');
      setIsLoading(false);
      return;
    }
    
    const state = parseBotState(stateParam);
    if (state?.userId) {
      console.log("Complete session data received:", {
        userId: state.userId,
        hasWallet: !!state.walletAddress,
        hasEmail: !!state.email,
        hasCrossmintUserId: !!state.crossmintUserId,
        hasAuthToken: !!state.authToken
      });
      
      setUserId(state.userId);
      
      if (state.walletAddress) {
        setWalletAddress(state.walletAddress);
      }
      
      if (state.email) {
        setUserEmail(state.email);
      }
      
      if (state.crossmintUserId) {
        setCrossmintUserId(state.crossmintUserId);
      }
      
      // If we have all the data, we don't need to make API calls
      if (state.walletAddress && state.email) {
        console.log("Complete session data available, ready for checkout");
        setIsLoading(false);
      } else {
        console.warn("Incomplete session data, falling back to API call");
        if (!BOT_API_URL) {
            setError('Configuration error: Bot API URL is not set. Please contact support.');
            setIsLoading(false);
        }
      }
    } else {
      setError('Error: Invalid user data. Please return to Telegram and use the /topup command again.');
      setIsLoading(false);
    }
  }, [searchParams]);

  // Fetch wallet if needed
  useEffect(() => {
    if (userId && !walletAddress && BOT_API_URL) {
      const fetchWallet = async () => {
      try {
        setIsLoading(true);
        const response = await axios.get(`${BOT_API_URL}/api/user/${userId}/wallet`);
        if (response.data.success && response.data.hasWallet) {
          setWalletAddress(response.data.wallet.address);
        } else {
          setError('Could not find a wallet for this user. Please /login in the bot first.');
        }
      } catch (e) {
        console.error('Failed to fetch wallet:', e);
        setError('Failed to connect to the bot server to get your wallet details.');
      } finally {
        setIsLoading(false);
      }
      };
      fetchWallet();
    }
  }, [userId, walletAddress]);

  // Payment completion handlers
  const restartFlow = useCallback(() => {
    setStep("options");
    setAmount("");
  }, []);

  const handleDone = useCallback(() => {
    restartFlow();
  }, [restartFlow]);

  const handlePaymentCompleted = useCallback(() => {
    setStep('completed');
    setTimeout(() => {
      handleDone();
    }, 3000);
  }, [handleDone]);

  const handleProcessingPayment = useCallback(() => {
    setStep("processing");
  }, []);

  // Render logic
  const renderContent = () => {
    if (isLoading) {
      return <p>Loading your wallet information...</p>;
    }
    if (error) {
      return (
        <div className="text-center">
          <p className="text-red-500 mb-4">Error: {error}</p>
          <Button 
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.close();
                window.location.href = "https://t.me/crossmint_bot";
              }
            }}
            variant="outline"
          >
            Return to Telegram
          </Button>
        </div>
      );
    }
    if (!walletAddress) {
      return (
        <div className="text-center">
          <p className="text-red-500 mb-4">Could not load wallet address.</p>
          <Button 
            onClick={() => {
              if (typeof window !== 'undefined') {
                window.close();
                window.location.href = "https://t.me/crossmint_bot";
              }
            }}
            variant="outline"
          >
            Return to Telegram
          </Button>
        </div>
      );
    }

    if (step === 'completed') {
        return (
            <div className="text-center">
                <h2 className="text-2xl font-bold text-green-600">Payment Successful!</h2>
                <p className="mt-2 text-gray-600">Your funds have been added to your wallet.</p>
                <p className="mt-4 text-sm text-gray-500">You can now close this window and return to Telegram.</p>
            </div>
        );
    }

    if (step === 'processing') {
      return (
        <div className="text-center">
          <h2 className="text-xl font-semibold">Processing Payment...</h2>
          <p className="mt-2 text-gray-600">Please wait while we process your payment.</p>
        </div>
      );
    }

    return (
      <>
        <h2 className="mb-2 text-2xl font-bold">Top up your Wallet</h2>
        <p className="mb-6 text-gray-500">Enter the amount you want to add.</p>
        
        <div className="mb-6 flex w-full flex-col items-center">
          <AmountInput amount={amount} onChange={setAmount} />
          {Number(amount) > MAX_AMOUNT && (
            <div className="mt-1 text-center text-red-600">
              Transaction amount exceeds the maximum allowed deposit limit of ${MAX_AMOUNT}
            </div>
          )}
        </div>

        <div className="flex w-full flex-grow flex-col">
          <Checkout
            amount={amount}
            isAmountValid={Number(amount) <= MAX_AMOUNT && Number(amount) > 0}
            walletAddress={walletAddress}
            onPaymentCompleted={handlePaymentCompleted}
            receiptEmail={userEmail || ""}
            onProcessingPayment={handleProcessingPayment}
            step={step}
            goBack={restartFlow}
          />
        </div>
      </>
    );
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
            <div className="flex flex-col items-center">
          {step === "options" && <TestingCardModal />}
                {renderContent()}
            </div>
        </div>
    </main>
  );
}

export default function TopUp() {
    return (
        <CrossmintProvider apiKey={CLIENT_API_KEY as string}>
            <CrossmintCheckoutProvider>
        <Suspense fallback={<div>Loading...</div>}>
            <TopUpPage />
        </Suspense>
            </CrossmintCheckoutProvider>
        </CrossmintProvider>
    )
}
