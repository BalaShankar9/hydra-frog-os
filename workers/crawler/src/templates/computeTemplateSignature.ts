/**
 * Template Signature Generator
 * 
 * Computes a structural signature of an HTML page that is:
 * - Content-independent (ignores text, only structure matters)
 * - Stable (same structure = same signature)
 * - Fast (minimal parsing overhead)
 */

import { load } from 'cheerio';
import type { Element as CheerioElement, ParentNode } from 'domhandler';
import { createHash } from 'node:crypto';

/**
 * Landmark element types to count
 */
const LANDMARK_TAGS = ['header', 'nav', 'main', 'footer', 'section', 'article', 'form'] as const;

/**
 * Form element types to count
 */
const FORM_ELEMENT_TAGS = ['input', 'button', 'select', 'textarea'] as const;

/**
 * Tags to remove before computing signature
 */
const STRIP_TAGS = ['script', 'style', 'noscript', 'svg', 'iframe'];

/**
 * Maximum elements to sample for DOM skeleton
 */
const MAX_SKELETON_ELEMENTS = 150;

/**
 * Maximum body top-level tags to record
 */
const MAX_TOP_LEVEL_TAGS = 30;

/**
 * Maximum class tokens to sample
 */
const MAX_CLASS_TOKENS = 15;

/**
 * Maximum length of individual class token
 */
const MAX_CLASS_TOKEN_LENGTH = 20;

/**
 * Template signature structure
 */
export interface TemplateSignature {
  bodyTopLevelTags: string[];
  landmarkCounts: Record<string, number>;
  formElements: Record<string, number>;
  linkStats: {
    totalLinks: number;
  };
  domSkeletonSample: string[];
  classTokensSample: string[];
}

/**
 * Result from computing template signature
 */
export interface TemplateSignatureResult {
  signatureJson: TemplateSignature;
  signatureHash: string;
}

/**
 * Compute a sha256 hash of the given string
 */
function sha256(data: string): string {
  return createHash('sha256').update(data, 'utf8').digest('hex');
}

/**
 * Clean and validate a class token
 */
function cleanClassToken(token: string): string | null {
  // Trim and lowercase
  const cleaned = token.trim().toLowerCase();
  
  // Skip empty, numeric-only, or very short tokens
  if (!cleaned || cleaned.length < 2 || /^\d+$/.test(cleaned)) {
    return null;
  }
  
  // Skip tokens that look like hashes or generated IDs
  if (/^[a-f0-9]{8,}$/i.test(cleaned) || /^_[a-z0-9]+$/i.test(cleaned)) {
    return null;
  }
  
  // Truncate long tokens
  return cleaned.slice(0, MAX_CLASS_TOKEN_LENGTH);
}

/**
 * Check if node is an element with a tagName
 */
function isElement(node: unknown): node is CheerioElement {
  return typeof node === 'object' && node !== null && (node as CheerioElement).type === 'tag';
}

/**
 * Build the path from body to an element (e.g., "body>div>main>section>article")
 */
function buildElementPath(el: CheerioElement): string {
  const pathParts: string[] = [];
  let current: CheerioElement | ParentNode | null = el;
  
  while (current && isElement(current)) {
    pathParts.unshift(current.tagName.toLowerCase());
    current = current.parent;
  }
  
  return pathParts.join('>');
}

/**
 * Compute the template signature for an HTML document
 * 
 * @param html - Raw HTML string
 * @returns Template signature with JSON structure and hash, or null if parsing fails
 */
export function computeTemplateSignature(html: string): TemplateSignatureResult | null {
  try {
    // Load HTML with cheerio
    const $ = load(html);
    
    // Strip unwanted elements before processing
    $(STRIP_TAGS.join(',')).remove();
    
    // 1. Get body top-level tags (first N direct children of body)
    const bodyTopLevelTags: string[] = [];
    const bodyChildren = $('body').children();
    bodyChildren.slice(0, MAX_TOP_LEVEL_TAGS).each((_, el) => {
      if (isElement(el)) {
        bodyTopLevelTags.push(el.tagName.toLowerCase());
      }
    });
    
    // 2. Count landmark elements
    const landmarkCounts: Record<string, number> = {};
    for (const tag of LANDMARK_TAGS) {
      const count = $(tag).length;
      if (count > 0) {
        landmarkCounts[tag] = count;
      }
    }
    
    // 3. Count form elements
    const formElements: Record<string, number> = {};
    for (const tag of FORM_ELEMENT_TAGS) {
      const count = $(tag).length;
      if (count > 0) {
        formElements[tag] = count;
      }
    }
    
    // 4. Link statistics
    const links = $('a[href]');
    const linkStats = {
      totalLinks: links.length,
    };
    
    // 5. DOM skeleton sample - collect paths for first N elements
    const domSkeletonSample: string[] = [];
    const allElements = $('body *');
    const sampleSize = Math.min(allElements.length, MAX_SKELETON_ELEMENTS);
    
    for (let i = 0; i < sampleSize; i++) {
      const el = allElements[i];
      if (el && isElement(el)) {
        const path = buildElementPath(el);
        domSkeletonSample.push(path);
      }
    }
    
    // 6. Class tokens sample - collect unique, cleaned class tokens
    const classTokenSet = new Set<string>();
    $('[class]').each((_, el) => {
      if (classTokenSet.size >= MAX_CLASS_TOKENS) return false;
      
      const classAttr = $(el).attr('class') || '';
      const tokens = classAttr.split(/\s+/);
      
      for (const token of tokens) {
        if (classTokenSet.size >= MAX_CLASS_TOKENS) break;
        
        const cleaned = cleanClassToken(token);
        if (cleaned && !classTokenSet.has(cleaned)) {
          classTokenSet.add(cleaned);
        }
      }
      
      return true; // continue iteration
    });
    
    const classTokensSample = Array.from(classTokenSet).sort();
    
    // Build the signature JSON
    const signatureJson: TemplateSignature = {
      bodyTopLevelTags,
      landmarkCounts,
      formElements,
      linkStats,
      domSkeletonSample,
      classTokensSample,
    };
    
    // Compute hash of the deterministic JSON representation
    // Sort keys to ensure consistency
    const signatureHash = sha256(JSON.stringify(signatureJson));
    
    return {
      signatureJson,
      signatureHash,
    };
  } catch {
    // If parsing fails, return null
    return null;
  }
}
