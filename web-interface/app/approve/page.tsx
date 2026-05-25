"use client";

import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { 
  useCrossmintAuth,
  useWallet,
  CrossmintProvider
} from '@crossmint/client-sdk-react-ui';
import { Button } from '@/components/ui/button';

// Helper to parse the approval state safely
function parseApprovalState(encodedState: string | null): { 
  userId: number,
  transactionId: string,
  orderId: string,
  walletAddress?: string,
  crossmintUserId?: string,
  email?: string,
  authToken?: string,
  productTitle?: string,
  totalAmount?: string,
  totalCurrency?: string
} | null {
    if (!encodedState) return null;
    
    try {
        console.log("🔍 Parsing approval state from URL...");
        console.log("Raw encoded state length:", encodedState.length);
        
        // Decode from base64
        let decodedJson: string;
        try {
            decodedJson = Buffer.from(encodedState, 'base64').toString('utf-8');
            console.log("✅ Base64 decode successful, length:", decodedJson.length);
        } catch (decodeError) {
            console.error("❌ Base64 decode failed:", decodeError);
            // Try URL decoding as fallback
            try {
                decodedJson = decodeURIComponent(encodedState);
                console.log("✅ URL decode fallback successful");
            } catch (urlDecodeError) {
                console.error("❌ URL decode fallback also failed:", urlDecodeError);
                return null;
            }
        }
        
        // Clean control characters that can break JSON parsing
        const cleanedJson = decodedJson
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '') // Remove control characters
            .replace(/\\n/g, '\\\\n')                     // Escape literal \n
            .replace(/\\r/g, '\\\\r')                     // Escape literal \r
            .replace(/\\t/g, '\\\\t')                     // Escape literal \t
            .replace(/\\/g, '\\\\')                       // Escape backslashes
            .trim();                                      // Remove leading/trailing whitespace
            
        console.log("🧹 Cleaned JSON string (first 200 chars):", cleanedJson.substring(0, 200));
        
        // Parse JSON with better error handling
        let parsed: any;
        try {
            parsed = JSON.parse(cleanedJson);
            console.log("✅ JSON parse successful");
        } catch (jsonError) {
            console.error("❌ JSON parse failed after cleaning:", jsonError);
            console.log("Failed JSON string (first 500 chars):", cleanedJson.substring(0, 500));
            
            // Try to extract data using regex as last resort
            try {
                console.log("🔄 Attempting regex extraction as fallback...");
                const userIdMatch = cleanedJson.match(/"userId"\s*:\s*(\d+)/);
                const transactionIdMatch = cleanedJson.match(/"transactionId"\s*:\s*"([^"]+)"/);
                const orderIdMatch = cleanedJson.match(/"orderId"\s*:\s*"([^"]+)"/);
                
                if (userIdMatch && transactionIdMatch && orderIdMatch) {
                    console.log("✅ Regex extraction successful");
                    return {
                        userId: parseInt(userIdMatch[1]),
                        transactionId: transactionIdMatch[1],
                        orderId: orderIdMatch[1],
                        // Try to extract other optional fields
                        walletAddress: cleanedJson.match(/"walletAddress"\s*:\s*"([^"]+)"/)?.[1],
                        crossmintUserId: cleanedJson.match(/"crossmintUserId"\s*:\s*"([^"]+)"/)?.[1],
                        email: cleanedJson.match(/"email"\s*:\s*"([^"]+)"/)?.[1],
                        authToken: cleanedJson.match(/"authToken"\s*:\s*"([^"]+)"/)?.[1],
                        productTitle: cleanedJson.match(/"productTitle"\s*:\s*"([^"]+)"/)?.[1],
                        totalAmount: cleanedJson.match(/"totalAmount"\s*:\s*"([^"]+)"/)?.[1],
                        totalCurrency: cleanedJson.match(/"totalCurrency"\s*:\s*"([^"]+)"/)?.[1],
                    };
                }
            } catch (regexError) {
                console.error("❌ Regex extraction also failed:", regexError);
            }
            
            return null;
        }
        
        // Validate required fields
        if (parsed && 
            typeof parsed.userId === 'number' && 
            typeof parsed.transactionId === 'string' && 
            typeof parsed.orderId === 'string' &&
            parsed.userId > 0 &&
            parsed.transactionId.trim() !== '' &&
            parsed.orderId.trim() !== '') {
            
            console.log("✅ Approval state validation successful");
            console.log("Parsed data:", {
                userId: parsed.userId,
                transactionId: parsed.transactionId,
                orderId: parsed.orderId,
                hasWalletAddress: !!parsed.walletAddress,
                hasProductTitle: !!parsed.productTitle
            });
            
            return parsed;
        } else {
            console.error("❌ Invalid approval state structure:", {
                hasUserId: 'userId' in parsed,
                hasTransactionId: 'transactionId' in parsed,
                hasOrderId: 'orderId' in parsed,
                userIdType: typeof parsed.userId,
                parsed: parsed
            });
            return null;
        }
        
    } catch (error) {
        console.error("❌ Failed to parse approval state from URL:", error);
        console.log("Raw encoded state (first 100 chars):", encodedState.substring(0, 100));
        return null;
    }
}

// Get BOT API URL
const BOT_API_URL = process.env.NEXT_PUBLIC_BOT_API_URL;

// Get Crossmint Client API Key
const CLIENT_API_KEY = process.env.NEXT_PUBLIC_CROSSMINT_CLIENT_API_KEY;

// Main Approval Component
function ApprovalPage() {
  const searchParams = useSearchParams();
  const { user, login } = useCrossmintAuth();
  const { wallet } = useWallet();
  
  const [approvalData, setApprovalData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isApproving, setIsApproving] = useState(false);
  const [approvalStatus, setApprovalStatus] = useState<'pending' | 'approving' | 'success'>('pending');
  const [authStatus, setAuthStatus] = useState<'loading' | 'authenticated' | 'unauthenticated'>('loading');
  const [transactionDetails, setTransactionDetails] = useState<any>(null);
  const [pendingMessage, setPendingMessage] = useState<string | null>(null);
  const [signerLocator, setSignerLocator] = useState<string | null>(null);

  // Initialize approval data from URL state
  useEffect(() => {
    const stateParam = searchParams.get('state');
    
    if (!stateParam) {
      console.error("No state parameter found in URL");
      setError('Missing transaction information. Please return to Telegram and try again.');
      setIsLoading(false);
      return;
    }
    
    const state = parseApprovalState(stateParam);
    if (!state) {
      setError('Invalid transaction data. Please return to Telegram and try again.');
      setIsLoading(false);
      return;
    }
    
    console.log("Approval data received:", {
      userId: state.userId,
      transactionId: state.transactionId,
      orderId: state.orderId,
      productTitle: state.productTitle,
      totalAmount: state.totalAmount,
      totalCurrency: state.totalCurrency
    });
    
    setApprovalData(state);
    setIsLoading(false);
  }, [searchParams]);

  // Check authentication and fetch transaction details
  useEffect(() => {
    const checkAuthAndFetchTransaction = async () => {
      if (!approvalData) return;
      
      // Wait for provider to initialize
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      console.log("Authentication check:");
      console.log("- User:", user ? "authenticated" : "not authenticated");
      console.log("- Wallet:", wallet ? wallet.address : "no wallet");
      console.log("- Expected wallet:", approvalData.walletAddress);
      
      // Check authentication status
      if (!user || !wallet) {
        console.log("User not authenticated with Client SDK - they need to log in");
        setAuthStatus('unauthenticated');
        return;
      }
      
      if (wallet.address.toLowerCase() !== approvalData.walletAddress.toLowerCase()) {
        console.log("Wallet address mismatch!");
        setError(`Wallet mismatch. Connected: ${wallet.address}, Expected: ${approvalData.walletAddress}`);
        setAuthStatus('unauthenticated');
        return;
      }
      
      console.log("User properly authenticated with Client SDK");
      setAuthStatus('authenticated');
      
      // Fetch transaction details to get pending message hash
      try {
        console.log("Fetching transaction details for dynamic message extraction...");
        
        const response = await fetch('/api/get-transaction-details', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            walletAddress: approvalData.walletAddress,
            transactionId: approvalData.transactionId
          })
        });
        
        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        
        if (result.error) {
          throw new Error(result.error);
        }
        
        console.log("Transaction details fetched successfully:", result);
        setTransactionDetails(result.transaction);
        setPendingMessage(result.pendingMessage);
        setSignerLocator(result.signerLocator);
        
        if (!result.pendingMessage) {
          setError("No pending approval message found. Transaction may have already been approved.");
        }
        
      } catch (error) {
        console.error("Failed to fetch transaction details:", error);
        setError(`Failed to load transaction details: ${error instanceof Error ? error.message : String(error)}`);
      }
    };
    
    checkAuthAndFetchTransaction();
  }, [approvalData, user, wallet]);

  // Handle transaction approval with proper Crossmint API
  const handleApproveTransaction = useCallback(async () => {
    if (!approvalData || !pendingMessage || !signerLocator) {
      setError('Missing required data for approval');
      return;
    }

    if (!user || !wallet) {
      setError('Please log in with your Crossmint wallet first to approve this transaction.');
      return;
    }

    setIsApproving(true);
    setApprovalStatus('approving');
    setError(null);

    try {
      console.log("Starting transaction approval for:", approvalData.transactionId);
      console.log("Message to sign:", pendingMessage);
      console.log("Signer locator:", signerLocator);
      
      // Use the Crossmint Client SDK to handle transaction approval
      const crossmintWallet = wallet as any;
      
      console.log("Inspecting available wallet methods...");
      const walletMethods = Object.getOwnPropertyNames(crossmintWallet).filter(name => 
        typeof crossmintWallet[name] === 'function'
      );
      console.log("Available wallet methods:", walletMethods);
      console.log("Wallet object keys:", Object.keys(crossmintWallet));
      
      // Deep inspection of wallet object structure
      console.log("Wallet object type:", typeof crossmintWallet);
      console.log("Wallet constructor:", crossmintWallet.constructor?.name);
      console.log("Wallet prototype methods:", Object.getOwnPropertyNames(Object.getPrototypeOf(crossmintWallet)));
      
      // Check for nested objects that might contain signing methods
      Object.keys(crossmintWallet).forEach(key => {
        const value = crossmintWallet[key];
        if (value && typeof value === 'object') {
          console.log(`Wallet.${key} methods:`, Object.getOwnPropertyNames(value).filter(name => 
            typeof value[name] === 'function'
          ));
        }
      });
      
      // Check wallet capabilities and choose the right approach
      console.log("🔍 Checking wallet capabilities...");
      console.log("Has signMessage:", typeof crossmintWallet.signMessage === 'function');
      console.log("Has approveTransaction:", typeof crossmintWallet.approveTransaction === 'function');
      
      // Let's try different approaches specific to Crossmint
      let approvalResult: any = null;
      let method = 'unknown';
      
      // Simple approach: Just use wallet.approveTransaction and intercept the API call
      // to fix the signature format issue at the network level
      try {
        console.log("🔄 Using wallet.approveTransaction (fixing signature format via network interception)");
        method = 'approveTransaction';
        
        // Intercept the Crossmint API calls to fix signature format
        const originalFetch = window.fetch;
        window.fetch = async function(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
          const url = typeof input === 'string' ? input : input.toString();
          
          // Intercept Crossmint approval API calls
          if (url.includes('staging.crossmint.com') && url.includes('/approvals') && init?.method === 'POST') {
            console.log("🔧 Intercepting Crossmint approval API call to fix signature format");
            
            try {
              const body = init.body ? JSON.parse(init.body as string) : {};
              
              // Fix signature format: convert hex to decimal strings
              if (body.approvals && Array.isArray(body.approvals)) {
                body.approvals.forEach((approval: any) => {
                  if (approval.signature && approval.signature.r && approval.signature.s) {
                    // Convert hex to decimal if needed
                    if (typeof approval.signature.r === 'string' && approval.signature.r.startsWith('0x')) {
                      console.log("🔧 Converting signature.r from hex to decimal");
                      approval.signature.r = BigInt(approval.signature.r).toString();
                    }
                    if (typeof approval.signature.s === 'string' && approval.signature.s.startsWith('0x')) {
                      console.log("🔧 Converting signature.s from hex to decimal");
                      approval.signature.s = BigInt(approval.signature.s).toString();
                    }
                  }
                });
              }
              
              console.log("🔧 Fixed approval payload:", JSON.stringify(body, null, 2));
              
              // Make the call with fixed payload
              const fixedInit = {
                ...init,
                body: JSON.stringify(body)
              };
              
              const response = await originalFetch(input, fixedInit);
              
              // Restore original fetch
              window.fetch = originalFetch;
              
              return response;
            } catch (interceptError) {
              console.error("❌ Error intercepting API call:", interceptError);
              // Restore original fetch and fall back to original call
              window.fetch = originalFetch;
              return originalFetch(input, init);
            }
          }
          
          // For all other calls, use original fetch
          return originalFetch(input, init);
        };
        
        // Now use the wallet's approveTransaction method normally
        console.log("🔐 Triggering wallet approval with signature format fix...");
        approvalResult = await crossmintWallet.approveTransaction(approvalData.transactionId);
        console.log("✅ Approval completed:", approvalResult);
        
                 // Restore original fetch (just in case)
         window.fetch = originalFetch;
         
         console.log(`✅ Approval successful using method: ${method}`);
         console.log("Approval result:", approvalResult);
         
         // Notify bot that approval completed
         if (BOT_API_URL) {
           try {
             await fetch(`${BOT_API_URL}/api/webhook/transaction-approved`, {
               method: 'POST',
               headers: {
                 'Content-Type': 'application/json',
               },
               body: JSON.stringify({
                 userId: approvalData.userId,
                 transactionId: approvalData.transactionId,
                 orderId: approvalData.orderId,
                 status: 'approved',
                 walletAddress: approvalData.walletAddress,
                 method: method
               })
             });
             console.log("✅ Bot notified of approval completion");
           } catch (webhookError) {
             console.warn("⚠️ Failed to notify bot:", webhookError);
             // Don't fail the approval process if webhook fails
           }
         }

         setApprovalStatus('success');
         console.log("✅ Transaction approved successfully");
         
               } catch (methodError) {
          console.error(`❌ Method ${method} failed:`, methodError);
          throw new Error(`Approval method '${method}' failed: ${methodError instanceof Error ? methodError.message : String(methodError)}`);
        }

      } catch (error) {
        console.error('❌ Error approving transaction:', error);
        setApprovalStatus('pending');
        setError(`Failed to approve transaction: ${error instanceof Error ? error.message : String(error)}`);
      } finally {
        setIsApproving(false);
      }
  }, [approvalData, wallet, user, pendingMessage, signerLocator]);

  // Render logic
  const renderContent = () => {
    if (isLoading) {
      return <p>Loading transaction details...</p>;
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

    if (!approvalData) {
      return (
        <div className="text-center">
          <p className="text-red-500 mb-4">No transaction data found.</p>
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

    if (approvalStatus === 'success') {
      return (
        <div className="text-center">
          <h2 className="text-2xl font-bold text-green-600">Transaction Approved!</h2>
          <p className="mt-2 text-gray-600">Your payment has been approved and is being processed.</p>
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <p className="text-sm text-gray-600">
              <strong>Order ID:</strong> {approvalData.orderId}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Product:</strong> {approvalData.productTitle}
            </p>
            <p className="text-sm text-gray-600">
              <strong>Amount:</strong> {approvalData.totalAmount} {approvalData.totalCurrency}
            </p>
          </div>
          <p className="mt-4 text-sm text-gray-500">You can now close this window and return to Telegram.</p>
        </div>
      );
    }

    if (approvalStatus === 'approving') {
      return (
        <div className="text-center">
          <h2 className="text-xl font-semibold">Approving Transaction...</h2>
          <p className="mt-2 text-gray-600">Please wait while we process your approval.</p>
          <div className="mt-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          </div>
        </div>
      );
    }

    return (
      <>
        <h2 className="mb-2 text-2xl font-bold">Approve Transaction</h2>
        <p className="mb-6 text-gray-500">Review and approve your purchase.</p>
        
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-4 mb-4">
            <div className="flex">
              <div className="ml-3">
                <h3 className="text-sm font-medium text-red-800">Error</h3>
                <div className="mt-2 text-sm text-red-700">{error}</div>
              </div>
            </div>
          </div>
        )}

        {authStatus !== 'authenticated' ? (
          // Show login interface if user is not authenticated
          <div className="bg-blue-50 border border-blue-200 rounded-md p-6 mb-6">
            <h3 className="text-lg font-medium text-blue-800 mb-2">Authentication Required</h3>
            <p className="text-blue-700 mb-4">
              To approve this transaction, you need to log in with your Crossmint wallet that contains the passkey.
            </p>
            <Button 
              onClick={() => login()}
              className="w-full"
              disabled={authStatus === 'loading'}
            >
              {authStatus === 'loading' ? 'Connecting...' : 'Log in with Crossmint'}
            </Button>
          </div>
        ) : (
          // Show approval interface when properly authenticated
          <>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Product</label>
                <p className="mt-1 text-sm text-gray-900">{approvalData.productTitle}</p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700">Amount</label>
                  <p className="mt-1 text-sm text-gray-900">{approvalData.totalAmount} {approvalData.totalCurrency}</p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700">Transaction ID</label>
                  <p className="mt-1 text-sm text-gray-900 font-mono text-xs break-all">{approvalData.transactionId}</p>
                </div>
              </div>
              
              {pendingMessage && (
                <div>
                  <label className="block text-sm font-medium text-gray-700">Message Hash</label>
                  <p className="mt-1 text-sm text-gray-500 font-mono text-xs break-all">{pendingMessage}</p>
                </div>
              )}
            </div>

            {/* Error Display */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-md p-4">
                <div className="flex">
                  <div className="ml-3">
                    <h3 className="text-sm font-medium text-red-800">Approval Failed</h3>
                    <div className="mt-2 text-sm text-red-700">{error}</div>
                    <Button 
                      onClick={() => {
                        setApprovalStatus('pending');
                        setError(null);
                      }}
                      className="mt-3"
                      variant="outline"
                    >
                      Try Again
                    </Button>
                  </div>
                </div>
              </div>
            )}

            {/* Approval Button */}
            {approvalStatus === 'pending' && (
              <Button 
                onClick={handleApproveTransaction}
                disabled={isApproving || !pendingMessage}
                className="w-full"
              >
                {isApproving ? 'Processing...' : 'Approve Transaction with Passkey'}
              </Button>
            )}
          </>
        )}
      </>
    );
  };

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-lg bg-white p-8 shadow-md">
        <div className="flex flex-col items-center">
          {renderContent()}
        </div>
      </div>
    </main>
  );
}

export default function Approve() {
    return (
        <CrossmintProvider apiKey={CLIENT_API_KEY as string}>
            <Suspense fallback={<div>Loading...</div>}>
                <ApprovalPage />
            </Suspense>
        </CrossmintProvider>
    );
}
