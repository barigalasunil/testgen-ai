import { SITE_NAVIGATION_TIMEOUT } from './types';
import type { FailureClassification, FailureType, HealingCategory } from './types';

function classification(type: FailureType, category: HealingCategory, rootCause: string, confidence: number): FailureClassification {
    return {
        type,
        failureType: type,
        category,
        isHealable: category === 'HEALABLE',
        confidence,
        rootCause,
        reason: rootCause,
    };
}

export function classifyFailure(output: string): FailureClassification {
    const cleanOutput = stripAnsi(output);
    const lower = cleanOutput.toLowerCase();
    if (output.includes(SITE_NAVIGATION_TIMEOUT) || lower.includes('net::err_connection') || lower.includes('site down')) {
        return classification('SITE_DOWN', 'NOT_HEALABLE', 'Application was unreachable from the automation runtime.', 0.95);
    }
    if (lower.includes('net::err_name_not_resolved') || lower.includes('dns')) {
        return classification('DNS_FAILURE', 'NOT_HEALABLE', 'DNS resolution failed.', 0.96);
    }
    if (lower.includes('ssl') || lower.includes('certificate') || lower.includes('net::err_cert')) {
        return classification('SSL_FAILURE', 'NOT_HEALABLE', 'TLS or certificate validation failed.', 0.94);
    }
    if (/\b50\d\b/.test(output) || lower.includes('http 5')) {
        return classification('HTTP_5XX', 'NOT_HEALABLE', 'Server returned a 5xx response.', 0.9);
    }
    if (lower.includes('epic sadface') || lower.includes('authentication') || lower.includes('unauthorized') || lower.includes('invalid credentials')) {
        return classification('AUTHENTICATION_FAILURE', 'NOT_HEALABLE', 'Authentication failed or credentials were rejected.', 0.88);
    }
    if (lower.includes('test data') || lower.includes('csv') || lower.includes('expected at least one')) {
        return classification('INVALID_TEST_DATA', 'NOT_HEALABLE', 'Input data required by the test is invalid or missing.', 0.86);
    }
    if (lower.includes('business') || lower.includes('order complete') || lower.includes('checkout')) {
        return classification('BUSINESS_LOGIC_FAILURE', 'NOT_HEALABLE', 'Failure appears tied to product behavior rather than automation mechanics.', 0.72);
    }
    if (lower.includes('detached') || lower.includes('not attached to the dom')) {
        return classification('ELEMENT_DETACHED', 'HEALABLE', 'Element detached while Playwright was interacting with it.', 0.84);
    }
    if (lower.includes('tohavetext') || lower.includes('expected string') || lower.includes('received string') || (lower.includes('expected:') && lower.includes('received:'))) {
        return classification('TEXT_ASSERTION_MISMATCH', 'HEALABLE', 'Assertion text differs from runtime text.', 0.78);
    }
    if (/timeout:\s*\d{1,3}ms/i.test(cleanOutput)) {
        return classification('TIMING_ISSUE', 'HEALABLE', 'A very short wait or assertion timeout expired before the UI became ready.', 0.82);
    }
    if (lower.includes('waiting for locator(') || /locator\([^)]*\)\.(click|fill|check|selectoption|hover|press):\s*timeout/i.test(cleanOutput)) {
        return classification('LOCATOR_NOT_FOUND', 'HEALABLE', 'Locator could not resolve to a usable element.', 0.9);
    }
    if (lower.includes('not visible') || lower.includes('hidden') || lower.includes('to be visible')) {
        return classification('ELEMENT_HIDDEN', 'HEALABLE', 'Element exists but is not visible at assertion or action time.', 0.82);
    }
    if (lower.includes('expect')) {
        return classification('TEXT_ASSERTION_MISMATCH', 'HEALABLE', 'Assertion text differs from runtime text.', 0.72);
    }
    if (lower.includes('locator') || lower.includes('selector') || lower.includes('strict mode violation')) {
        return classification('LOCATOR_NOT_FOUND', 'HEALABLE', 'Locator could not resolve to a usable element.', 0.84);
    }
    if (lower.includes('tohaveurl') || lower.includes('waitforurl') || lower.includes('navigation')) {
        return classification('NAVIGATION_WAIT_ISSUE', 'HEALABLE', 'Navigation did not reach the expected state within the timeout.', 0.8);
    }
    if (lower.includes('waitfortimeout') || lower.includes('timeout')) {
        return classification('TIMING_ISSUE', 'HEALABLE', 'A wait or action timed out before the UI became ready.', 0.72);
    }
    return classification('UNKNOWN', 'UNKNOWN', 'Failure did not match a known healing pattern.', 0.35);
}

export function failureReasonLabel(output: string) {
    const classification = classifyFailure(output);
    if (classification.type === 'SITE_DOWN') return SITE_NAVIGATION_TIMEOUT;
    return classification.type.toLowerCase().replace(/_/g, ' ');
}

export function stripAnsi(value: string) {
    return value.replace(/\u001b\[[0-9;]*m/g, '');
}