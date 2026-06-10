"use client";

import { useEffect } from "react";
import { ClassicWorkspaceLayout } from "./layouts/ClassicWorkspaceLayout";
import { useTCGenWorkspace } from "../hooks/useTCGenWorkspace";

export function MainApp() {
    const workspace = useTCGenWorkspace();

    useEffect(() => {
        localStorage.removeItem("testgen-ui-mode");
        localStorage.removeItem("testgen-theme");
        document.documentElement.classList.remove("dark");
    }, []);

    return <ClassicWorkspaceLayout workspace={workspace} />;
}
