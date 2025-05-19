/**
 * Conversation utility functions
 * 
 * This module provides utility functions for conversation management,
 * particularly for generating deterministic conversation IDs based on participant UIDs.
 */

import { v4 as uuidv4 } from 'uuid';

/**
 * Simple hash function that works in any environment
 * @param str - String to hash
 * @returns A deterministic hash value as string
 */
const simpleHash = (str: string): string => {
  let hash = 0;
  if (str.length === 0) return hash.toString(16).padStart(32, '0');
  
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32bit integer
  }
  
  // Convert to hex string and ensure it's 32 chars long
  let hashHex = Math.abs(hash).toString(16);
  while (hashHex.length < 32) {
    hashHex = '0' + hashHex;
  }
  
  return hashHex.substring(0, 32);
};

/**
 * Formats a string as a valid UUID
 * @param hashStr - The string to format as UUID
 * @returns A string in valid UUID format
 */
const formatAsUuid = (hashStr: string): string => {
  // Ensure we have enough characters
  while (hashStr.length < 32) {
    hashStr += '0';
  }
  
  // Take only the first 32 characters if longer
  hashStr = hashStr.substring(0, 32);
  
  // Format as UUID: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
  // Where y is 8, 9, a, or b (for UUID v4 format)
  const p1 = hashStr.substring(0, 8);
  const p2 = hashStr.substring(8, 12);
  const p3 = '4' + hashStr.substring(13, 16); // Version 4 UUID
  
  // Set the high bits of the 7th byte to 1 0 (8, 9, a, or b)
  const highBits = '8'; // Use 8 consistently for deterministic generation
  const p4 = highBits + hashStr.substring(17, 20);
  
  const p5 = hashStr.substring(20, 32);
  
  return `${p1}-${p2}-${p3}-${p4}-${p5}`;
};

/**
 * Tries to use the Web Crypto API if available
 * @param str - String to hash
 * @returns A promise that resolves to a hex hash
 */
const cryptoHash = async (str: string): Promise<string> => {
  // Check if Web Crypto API is available
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    try {
      const msgBuffer = new TextEncoder().encode(str);
      const hashBuffer = await window.crypto.subtle.digest('SHA-256', msgBuffer);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
      return hashHex;
    } catch (error) {
      console.warn('Web Crypto API failed, falling back to simple hash:', error);
      return simpleHash(str);
    }
  }
  
  // Fallback to simple hash if Web Crypto API is not available
  return simpleHash(str);
};

/**
 * Generates a deterministic conversation ID based on participant user IDs.
 * Ensures the same ID is generated regardless of the order of participants.
 * 
 * @param userIds - Array of user IDs participating in the conversation
 * @returns A deterministic conversation ID as a valid UUID string
 */
export const generateConversationId = async (userIds: string[]): Promise<string> => {
  try {
    // Sort the user IDs to ensure the same order regardless of who initiates the conversation
    const sortedUserIds = [...userIds].sort();
    
    // Join the sorted IDs with a separator
    const joinedIds = sortedUserIds.join(':');
    
    // Calculate a hash of the joined IDs
    const hash = await cryptoHash(joinedIds);
    
    // Format as a valid UUID string for compatibility with existing code and Supabase
    return formatAsUuid(hash);
  } catch (error) {
    console.error('Error generating conversation ID:', error);
    // Fallback to a random UUID that's valid for Supabase
    return uuidv4();
  }
};

/**
 * Creates a key for storing temporary local-only conversations.
 * This allows the UI to show a conversation before it's actually created in the database.
 * The key is formatted as a valid UUID with a deterministic value based on participants.
 * 
 * @param userIds - Array of user IDs participating in the conversation
 * @returns A temporary local conversation key that's a valid UUID
 */
export const createLocalConversationKey = (userIds: string[]): string => {
  // Sort the user IDs to ensure the same order regardless of who initiates the conversation
  const sortedUserIds = [...userIds].sort();
  
  // Create a deterministic string from participant IDs
  const baseString = `temp-${sortedUserIds.join('-')}`;
  
  // Hash it to create a deterministic ID
  const hash = simpleHash(baseString);
  
  // Format as UUID
  return formatAsUuid(hash);
};

/**
 * Determines if two sets of user IDs would generate the same conversation key.
 * This helps identify if a temp conversation should be replaced with a real one.
 * 
 * @param userIdsA - First array of user IDs
 * @param userIdsB - Second array of user IDs to compare against
 * @returns True if the IDs would generate the same conversation
 */
export const isMatchingUserSets = (userIdsA: string[], userIdsB: string[]): boolean => {
  if (userIdsA.length !== userIdsB.length) return false;
  
  // Sort both arrays for comparison
  const sortedA = [...userIdsA].sort();
  const sortedB = [...userIdsB].sort();
  
  // Compare each element
  return sortedA.every((id, index) => id === sortedB[index]);
};

/**
 * Creates a temporary meta info object to store with local conversations
 * @param userIds - Participant user IDs
 * @returns An object with metadata about the local conversation
 */
export const createTempConversationInfo = async (userIds: string[]): Promise<{
  tempId: string;
  realId: string;
  participants: string[];
}> => {
  const sortedUserIds = [...userIds].sort();
  const tempId = createLocalConversationKey(sortedUserIds);
  const realId = await generateConversationId(sortedUserIds);
  
  return {
    tempId,
    realId,
    participants: sortedUserIds
  };
};

/**
 * Generates a key for user-specific conversation preferences in the format
 * expected by the user_conversation_preferences table.
 * 
 * @param userId - The user ID
 * @param conversationId - The conversation ID
 * @returns A preference key string
 */
export const generatePreferenceKey = (userId: string, conversationId: string): string => {
  return `pref_${userId}_${conversationId}`;
};

/**
 * Checks if a conversation ID is a valid UUID
 * @param id - The ID to check
 * @returns True if the ID is a valid UUID
 */
export const isValidUUID = (id: string): boolean => {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(id);
};

/**
 * Converts any non-UUID conversation ID to a valid UUID format
 * @param conversationId - The conversation ID to check
 * @returns A valid UUID version of the conversation ID
 */
export const ensureValidConversationId = (conversationId: string): string => {
  if (isValidUUID(conversationId)) {
    return conversationId;
  }
  
  // If not a valid UUID, hash it and format as UUID
  const hash = simpleHash(conversationId);
  return formatAsUuid(hash);
};

export default {
  generateConversationId,
  createLocalConversationKey,
  isMatchingUserSets,
  createTempConversationInfo,
  generatePreferenceKey,
  isValidUUID,
  ensureValidConversationId
};
