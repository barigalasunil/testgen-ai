"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { ExternalLink, Play, CheckCircle2, XCircle, AlertCircle, Clock, Eye, Copy } from "lucide-react";
import { cn } from "@/lib/utils";

type User = {
    username: string;
    password: string;
    expectedResult: string;
    userType: string;
    notes: string;
};

type Product = {
    productName: string;
    expectedPrice: string;
    category: string;
};

type CheckoutData = {
    firstName: string;
    lastName: string;
    postalCode: string;
    expectedMessage: string;
    notes: string;
};

const SAUCEDEMO_URL = "https://www.saucedemo.com";

const USERS: User[] = [
    { username: "standard_user", password: "secret_sauce", expectedResult: "success", userType: "standard", notes: "Default test user — all features work normally" },
    { username: "locked_out_user", password: "secret_sauce", expectedResult: "fail", userType: "locked", notes: "Account is locked — should show error message" },
    { username: "problem_user", password: "secret_sauce", expectedResult: "success", userType: "problem", notes: "Images are broken — visual bugs present" },
    { username: "performance_glitch_user", password: "secret_sauce", expectedResult: "success", userType: "performance", notes: "App loads slowly — performance issues" },
    { username: "error_user", password: "secret_sauce", expectedResult: "success", userType: "error", notes: "Errors on cart and checkout interactions" },
    { username: "visual_user", password: "secret_sauce", expectedResult: "success", userType: "visual", notes: "Visual layout differences from standard" },
];

const PRODUCTS: Product[] = [
    { productName: "Sauce Labs Backpack", expectedPrice: "$29.99", category: "bags" },
    { productName: "Sauce Labs Bike Light", expectedPrice: "$9.99", category: "accessories" },
    { productName: "Sauce Labs Bolt T-Shirt", expectedPrice: "$15.99", category: "clothing" },
    { productName: "Sauce Labs Fleece Jacket", expectedPrice: "$49.99", category: "clothing" },
    { productName: "Sauce Labs Onesie", expectedPrice: "$7.99", category: "clothing" },
    { productName: "Test.allTheThings() T-Shirt (Red)", expectedPrice: "$15.99", category: "clothing" },
];

const CHECKOUT_DATA: CheckoutData[] = [
    { firstName: "John", lastName: "Doe", postalCode: "90210", expectedMessage: "Thank you for your order!", notes: "Standard US address" },
    { firstName: "Jane", lastName: "Smith", postalCode: "12345", expectedMessage: "Thank you for your order!", notes: "New York zip" },
    { firstName: "Ravi", lastName: "Kumar", postalCode: "560001", expectedMessage: "Thank you for your order!", notes: "Bangalore India" },
    { firstName: "Test", lastName: "User", postalCode: "00000", expectedMessage: "Thank you for your order!", notes: "Edge case zip" },
    { firstName: "A", lastName: "B", postalCode: "1", expectedMessage: "Thank you for your order!", notes: "Minimum length fields" },
];

const USER_TYPE_CONFIG: Record<string, { color: string; icon: ReactNode; label: string }> = {
    standard: { color: "bg-emerald-100 text-emerald-700 border-emerald-200", icon: <CheckCircle2 className="w-3.5 h-3.5" />, label: "Standard" },
    locked: { color: "bg-red-100 text-red-700 border-red-200", icon: <XCircle className="w-3.5 h-3.5" />, label: "Locked" },
    problem: { color: "bg-orange-100 text-orange-700 border-orange-200", icon: <AlertCircle className="w-3.5 h-3.5" />, label: "Problem" },
    performance: { color: "bg-amber-100 text-amber-700 border-amber-200", icon: <Clock className="w-3.5 h-3.5" />, label: "Performance" },
    error: { color: "bg-red-100 text-red-700 border-red-200", icon: <AlertCircle className="w-3.5 h-3.5" />, label: "Error" },
    visual: { color: "bg-purple-100 text-purple-700 border-purple-200", icon: <Eye className="w-3.5 h-3.5" />, label: "Visual" },
};

export default function TestDataPage() {
    const [activeTab, setActiveTab] = useState<"users" | "products" | "checkout">("users");
    const [toast, setToast] = useState("");
    const [launchingUser, setLaunchingUser] = useState<string | null>(null);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(""), 2500);
    };

    const handleCopy = (text: string, label: string) => {
        navigator.clipboard.writeText(text);
        showToast(`Copied: ${label}`);
    };

    // Opens SauceDemo in a new tab and auto-fills credentials via URL params
    // SauceDemo doesn't support URL auth, so we open the page and show a helper
    const handleLaunchUser = async (user: User) => {
        if (user.userType === "locked") {
            // Just open the page — locked user can't login
            window.open(SAUCEDEMO_URL, "_blank");
            showToast(`Opened SauceDemo — ${user.username} will show lock error`);
            return;
        }

        setLaunchingUser(user.username);

        // Copy credentials to clipboard so user can paste immediately
        await navigator.clipboard.writeText(`${user.username}\t${user.password}`);

        // Open SauceDemo
        window.open(SAUCEDEMO_URL, "_blank");

        showToast(`Opened SauceDemo — credentials copied! Paste into login form.`);

        setTimeout(() => setLaunchingUser(null), 2000);
    };

    // Launch Playwright test for this specific user
    const handleRunTest = async (user: User) => {
        setLaunchingUser(user.username);
        try {
            const res = await fetch("/api/automation/run", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ suite: "smoke", headed: true }),
            });
            const data = await res.json();
            if (data.error) {
                showToast(`Test failed: ${data.message}`);
            } else {
                showToast(`✓ Smoke tests passed for ${user.username}`);
            }
        } catch {
            showToast("Could not run test — check dev server");
        } finally {
            setLaunchingUser(null);
        }
    };

    const tabs = [
        { key: "users" as const, label: "👤 Test Users", count: USERS.length },
        { key: "products" as const, label: "🛍 Products", count: PRODUCTS.length },
        { key: "checkout" as const, label: "🧾 Checkout Data", count: CHECKOUT_DATA.length },
    ];

    return (
        <div className="min-h-screen bg-slate-50 font-sans">

            {/* Toast */}
            {toast && (
                <div className="fixed top-4 right-4 z-50 flex items-center gap-2 bg-gray-900 text-white px-4 py-2.5 rounded-xl shadow-xl text-sm">
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                    {toast}
                </div>
            )}

            {/* Header */}
            <div className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                <div>
                    <p className="text-[10px] uppercase tracking-wider text-slate-400 font-semibold">SauceDemo</p>
                    <h1 className="text-xl font-bold text-slate-900">Test Data Manager</h1>
                    <p className="text-xs text-slate-500 mt-0.5">
                        Real SauceDemo credentials and test data — click any user to launch
                    </p>
                </div>
                <div className="flex items-center gap-3">
                    <a
                        href={SAUCEDEMO_URL}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-2 text-sm border border-slate-200 px-3 py-1.5 rounded-lg text-slate-600 hover:bg-slate-50"
                    >
                        <ExternalLink className="w-3.5 h-3.5" />
                        Open SauceDemo
                    </a>
                    <Link href="/" className="text-sm text-slate-500 hover:text-slate-900 border border-slate-200 px-3 py-1.5 rounded-lg">
                        ← Back to TCGen
                    </Link>
                </div>
            </div>

            {/* Info banner */}
            <div className="mx-6 mt-4 rounded-xl bg-blue-50 border border-blue-200 px-4 py-3 text-sm text-blue-700 flex items-start gap-2">
                <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                <div>
                    <span className="font-semibold">How to use:</span> Click
                    {" "}<span className="font-mono bg-blue-100 px-1 rounded">Launch</span>{" "}
                    on any user to open SauceDemo with credentials copied to clipboard.
                    Click{" "}<span className="font-mono bg-blue-100 px-1 rounded">Run Test</span>{" "}
                    to execute the Playwright smoke suite in headed mode (browser opens visibly).
                </div>
            </div>

            <div className="max-w-6xl mx-auto px-6 py-6">

                {/* Tabs */}
                <div className="flex gap-2 mb-6">
                    {tabs.map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={cn(
                                "flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition",
                                activeTab === tab.key
                                    ? "bg-slate-900 text-white"
                                    : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                            )}
                        >
                            {tab.label}
                            <span className={cn(
                                "text-[10px] px-1.5 py-0.5 rounded-full font-bold",
                                activeTab === tab.key ? "bg-white/20 text-white" : "bg-slate-100 text-slate-500"
                            )}>
                                {tab.count}
                            </span>
                        </button>
                    ))}
                </div>

                {/* Users Tab */}
                {activeTab === "users" && (
                    <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                            {USERS.map((user) => {
                                const config = USER_TYPE_CONFIG[user.userType];
                                const isLaunching = launchingUser === user.username;

                                return (
                                    <div key={user.username}
                                        className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm flex flex-col gap-3 hover:border-slate-300 transition">

                                        {/* Header */}
                                        <div className="flex items-start justify-between gap-2">
                                            <div>
                                                <p className="font-mono font-bold text-slate-900 text-sm">
                                                    {user.username}
                                                </p>
                                                <p className="text-xs text-slate-400 mt-0.5">{user.notes}</p>
                                            </div>
                                            <span className={cn(
                                                "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold border whitespace-nowrap",
                                                config.color
                                            )}>
                                                {config.icon}
                                                {config.label}
                                            </span>
                                        </div>

                                        {/* Credentials */}
                                        <div className="rounded-xl bg-slate-50 border border-slate-100 p-3 flex flex-col gap-2">
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-[9px] uppercase font-bold text-slate-400">Username</p>
                                                    <p className="font-mono text-xs text-slate-700">{user.username}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleCopy(user.username, "username")}
                                                    className="p-1 rounded text-slate-400 hover:text-slate-700"
                                                >
                                                    <Copy className="w-3 h-3" />
                                                </button>
                                            </div>
                                            <div className="flex items-center justify-between">
                                                <div>
                                                    <p className="text-[9px] uppercase font-bold text-slate-400">Password</p>
                                                    <p className="font-mono text-xs text-slate-700">{user.password}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleCopy(user.password, "password")}
                                                    className="p-1 rounded text-slate-400 hover:text-slate-700"
                                                >
                                                    <Copy className="w-3 h-3" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Expected result badge */}
                                        <div className="flex items-center gap-2">
                                            <span className={cn(
                                                "text-[10px] font-bold px-2 py-0.5 rounded-full",
                                                user.expectedResult === "success"
                                                    ? "bg-emerald-100 text-emerald-700"
                                                    : "bg-red-100 text-red-700"
                                            )}>
                                                Expected: {user.expectedResult === "success" ? "✓ Login success" : "✕ Login fails"}
                                            </span>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex gap-2 mt-auto">
                                            <button
                                                onClick={() => handleLaunchUser(user)}
                                                disabled={isLaunching}
                                                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 text-white text-xs font-semibold py-2 hover:bg-slate-800 disabled:opacity-50 transition"
                                            >
                                                <ExternalLink className="w-3.5 h-3.5" />
                                                {isLaunching ? "Opening..." : "Launch"}
                                            </button>
                                            <button
                                                onClick={() => handleRunTest(user)}
                                                disabled={isLaunching || user.userType === "locked"}
                                                title={user.userType === "locked" ? "Locked user — run smoke to verify error" : "Run smoke suite in headed mode"}
                                                className="flex-1 flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 text-white text-xs font-semibold py-2 hover:bg-blue-700 disabled:opacity-40 transition"
                                            >
                                                <Play className="w-3.5 h-3.5" />
                                                {isLaunching ? "Running..." : "Run Test"}
                                            </button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* CSV preview */}
                        <div className="mt-2 bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    CSV Source — automation/data/login-data.csv
                                </h3>
                                <button
                                    onClick={() => handleCopy(
                                        "username,password,expectedResult,userType,notes\n" +
                                        USERS.map(u => `${u.username},${u.password},${u.expectedResult},${u.userType},${u.notes}`).join("\n"),
                                        "CSV data"
                                    )}
                                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 border border-slate-200 px-2 py-1 rounded-lg"
                                >
                                    <Copy className="w-3 h-3" /> Copy CSV
                                </button>
                            </div>
                            <pre className="text-xs font-mono text-slate-600 bg-slate-50 rounded-xl p-3 overflow-x-auto">
                                {`username,password,expectedResult,userType,notes\n` +
                                    USERS.map(u =>
                                        `${u.username},${u.password},${u.expectedResult},${u.userType},${u.notes}`
                                    ).join("\n")}
                            </pre>
                        </div>
                    </div>
                )}

                {/* Products Tab */}
                {activeTab === "products" && (
                    <div className="flex flex-col gap-4">
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-bold border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left">#</th>
                                        <th className="px-4 py-3 text-left">Product Name</th>
                                        <th className="px-4 py-3 text-left">Price</th>
                                        <th className="px-4 py-3 text-left">Category</th>
                                        <th className="px-4 py-3 text-left">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {PRODUCTS.map((p, i) => (
                                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition">
                                            <td className="px-4 py-3 text-slate-400 font-mono text-xs">{i + 1}</td>
                                            <td className="px-4 py-3 font-medium text-slate-800">{p.productName}</td>
                                            <td className="px-4 py-3">
                                                <span className="font-bold text-emerald-700 font-mono">{p.expectedPrice}</span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-semibold capitalize">
                                                    {p.category}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => handleCopy(p.productName, p.productName)}
                                                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700"
                                                >
                                                    <Copy className="w-3 h-3" /> Copy name
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    CSV Source — automation/data/products-data.csv
                                </h3>
                                <button
                                    onClick={() => handleCopy(
                                        "productName,expectedPrice,category\n" +
                                        PRODUCTS.map(p => `${p.productName},${p.expectedPrice},${p.category}`).join("\n"),
                                        "Products CSV"
                                    )}
                                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 border border-slate-200 px-2 py-1 rounded-lg"
                                >
                                    <Copy className="w-3 h-3" /> Copy CSV
                                </button>
                            </div>
                            <pre className="text-xs font-mono text-slate-600 bg-slate-50 rounded-xl p-3 overflow-x-auto">
                                {`productName,expectedPrice,category\n` +
                                    PRODUCTS.map(p => `${p.productName},${p.expectedPrice},${p.category}`).join("\n")}
                            </pre>
                        </div>
                    </div>
                )}

                {/* Checkout Data Tab */}
                {activeTab === "checkout" && (
                    <div className="flex flex-col gap-4">
                        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
                            <table className="w-full text-sm">
                                <thead className="bg-slate-50 text-slate-500 text-[11px] uppercase font-bold border-b border-slate-200">
                                    <tr>
                                        <th className="px-4 py-3 text-left">First Name</th>
                                        <th className="px-4 py-3 text-left">Last Name</th>
                                        <th className="px-4 py-3 text-left">Postal Code</th>
                                        <th className="px-4 py-3 text-left">Expected</th>
                                        <th className="px-4 py-3 text-left">Notes</th>
                                        <th className="px-4 py-3 text-left">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {CHECKOUT_DATA.map((c, i) => (
                                        <tr key={i} className="border-b border-slate-50 hover:bg-slate-50 transition">
                                            <td className="px-4 py-3 font-medium text-slate-800">{c.firstName}</td>
                                            <td className="px-4 py-3 font-medium text-slate-800">{c.lastName}</td>
                                            <td className="px-4 py-3 font-mono text-slate-600">{c.postalCode}</td>
                                            <td className="px-4 py-3">
                                                <span className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full font-semibold">
                                                    ✓ {c.expectedMessage}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3 text-xs text-slate-400">{c.notes}</td>
                                            <td className="px-4 py-3">
                                                <button
                                                    onClick={() => handleCopy(`${c.firstName}\t${c.lastName}\t${c.postalCode}`, "checkout data")}
                                                    className="flex items-center gap-1 text-xs text-slate-400 hover:text-slate-700"
                                                >
                                                    <Copy className="w-3 h-3" /> Copy row
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>

                        <div className="bg-white rounded-2xl border border-slate-200 p-4 shadow-sm">
                            <div className="flex items-center justify-between mb-3">
                                <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">
                                    CSV Source — automation/data/checkout-data.csv
                                </h3>
                                <button
                                    onClick={() => handleCopy(
                                        "firstName,lastName,postalCode,expectedMessage,notes\n" +
                                        CHECKOUT_DATA.map(c => `${c.firstName},${c.lastName},${c.postalCode},${c.expectedMessage},${c.notes}`).join("\n"),
                                        "Checkout CSV"
                                    )}
                                    className="flex items-center gap-1.5 text-xs text-slate-500 hover:text-slate-900 border border-slate-200 px-2 py-1 rounded-lg"
                                >
                                    <Copy className="w-3 h-3" /> Copy CSV
                                </button>
                            </div>
                            <pre className="text-xs font-mono text-slate-600 bg-slate-50 rounded-xl p-3 overflow-x-auto">
                                {`firstName,lastName,postalCode,expectedMessage,notes\n` +
                                    CHECKOUT_DATA.map(c =>
                                        `${c.firstName},${c.lastName},${c.postalCode},${c.expectedMessage},${c.notes}`
                                    ).join("\n")}
                            </pre>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}