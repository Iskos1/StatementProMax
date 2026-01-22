/**
 * OpenAI Categorization Helper
 * Handles integration with OpenAI API for intelligent transaction categorization
 */

const AI_CONFIG = {
    model: "gpt-4o", // Best balance of intelligence and speed
    temperature: 0.3,
    max_tokens: 2000
};

// Standard Categories used in the app
const STANDARD_CATEGORIES = [
    "Income", "Groceries", "Dining & Restaurants", "Transportation", 
    "Shopping", "Utilities", "Internet & Phone", "Rent & Mortgage", 
    "Insurance", "Entertainment", "Health & Medical", "Education", 
    "Travel", "Fees & Charges", "Transfers & Payments", "Personal Care", 
    "Pet Care", "Donations", "Other"
];

/**
 * Check if API key is available
 */
export function hasApiKey() {
    return !!localStorage.getItem('openai_api_key');
}

/**
 * Save API Key
 */
export function saveApiKey(key) {
    if (!key || !key.startsWith('sk-')) {
        return false;
    }
    localStorage.setItem('openai_api_key', key);
    return true;
}

/**
 * Remove API Key
 */
export function removeApiKey() {
    localStorage.removeItem('openai_api_key');
}

/**
 * Get API Key
 */
function getApiKey() {
    return localStorage.getItem('openai_api_key');
}

/**
 * Batch categorize transactions using OpenAI
 * @param {Array} transactions - Array of {id, description, amount}
 * @returns {Promise<Object>} - Map of id -> suggested_category
 */
export async function categorizeWithAI(transactions) {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key missing");

    // Process in chunks to avoid token limits (e.g., 20 at a time)
    const CHUNK_SIZE = 20;
    const results = {};
    
    for (let i = 0; i < transactions.length; i += CHUNK_SIZE) {
        const chunk = transactions.slice(i, i + CHUNK_SIZE);
        
        // Prepare simplified list for prompt
        const listText = chunk.map(t => 
            `ID: ${t.id} | Desc: ${t.description} | Amount: ${t.amount}`
        ).join('\n');

        const prompt = `
You are a financial categorization assistant.
Analyze the following bank transactions descriptions to identify the merchant and business type.
Perform "research" based on your internal knowledge of merchants (e.g., identify specific restaurants, shops, subscription services).

Categorize them into exactly one of these categories:
${STANDARD_CATEGORIES.join(', ')}

Rules:
1. Return ONLY a JSON object where keys are the transaction IDs and values are the Category names.
2. Do not explain.
3. Use your internal knowledge to match vague descriptions to business types (e.g., "MCDONALDS" -> "Dining & Restaurants", "SQ *TEST" -> "Shopping").
4. "Income" is for positive amounts mostly (salary, deposit), but refunds (positive) can be "Shopping" or original category if obvious.
5. Use "Transfers & Payments" for credit card payments, zelle, venmo unless context is clear.
6. If a description implies a specific service (e.g., "Netflix", "Spotify"), categorize as "Entertainment".

Transactions:
${listText}
`;

        try {
            const response = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify({
                    model: AI_CONFIG.model,
                    messages: [
                        { role: "system", content: "You are a helpful financial assistant that outputs raw JSON." },
                        { role: "user", content: prompt }
                    ],
                    temperature: AI_CONFIG.temperature,
                    response_format: { type: "json_object" } 
                })
            });

            if (!response.ok) {
                const err = await response.json();
                throw new Error(err.error?.message || 'OpenAI API Error');
            }

            const data = await response.json();
            const content = data.choices[0].message.content;
            const parsed = JSON.parse(content);
            
            // Merge results
            Object.assign(results, parsed); // parsed should be { "id1": "Category", ... }

        } catch (error) {
            console.error("AI Categorization Error:", error);
            // Continue with other chunks if one fails? Or throw?
            // Let's throw to handle UI feedback
            throw error;
        }
    }

    return results;
}
