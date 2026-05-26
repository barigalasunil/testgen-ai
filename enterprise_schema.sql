-- Enterprise QA Traceability Schema

CREATE DATABASE IF NOT EXISTS tcgen_buddy_enterprise;
USE tcgen_buddy_enterprise;

-- Projects to isolate memory and items
CREATE TABLE IF NOT EXISTS projects (
    project_key VARCHAR(10) PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Requirements (Jira Stories, PRDs)
CREATE TABLE IF NOT EXISTS requirements (
    id INT AUTO_INCREMENT PRIMARY KEY,
    jira_story_id VARCHAR(50),
    title VARCHAR(255) NOT NULL,
    description TEXT,
    acceptance_criteria TEXT,
    business_context TEXT,
    project_key VARCHAR(10) NOT NULL,
    metadata JSON,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_key) REFERENCES projects(project_key)
);

-- Test Cases linked to requirements
CREATE TABLE IF NOT EXISTS testcases (
    id INT AUTO_INCREMENT PRIMARY KEY,
    testcase_id VARCHAR(50), -- e.g., TC-001
    title VARCHAR(255) NOT NULL,
    test_type VARCHAR(50) DEFAULT 'Functional',
    priority VARCHAR(20) DEFAULT 'Medium',
    preconditions TEXT,
    test_data TEXT,
    steps TEXT,
    expected_result TEXT,
    requirement_id INT,
    project_key VARCHAR(10) NOT NULL,
    automation_status ENUM('manual', 'pending', 'automated') DEFAULT 'manual',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_key) REFERENCES projects(project_key),
    FOREIGN KEY (requirement_id) REFERENCES requirements(id) ON DELETE SET NULL
);

-- Executions linked to test cases
CREATE TABLE IF NOT EXISTS executions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    testcase_id INT NOT NULL,
    status ENUM('passed', 'failed', 'skipped', 'blocked') NOT NULL,
    duration_ms INT,
    logs TEXT,
    error_message TEXT,
    project_key VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_key) REFERENCES projects(project_key),
    FOREIGN KEY (testcase_id) REFERENCES testcases(id) ON DELETE CASCADE
);

-- Defects linked back to executions and requirements
CREATE TABLE IF NOT EXISTS defects (
    id INT AUTO_INCREMENT PRIMARY KEY,
    defect_id VARCHAR(50), -- Jira Bug ID
    title VARCHAR(255) NOT NULL,
    description TEXT,
    status VARCHAR(50) DEFAULT 'New',
    requirement_id INT,
    execution_id INT,
    project_key VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_key) REFERENCES projects(project_key),
    FOREIGN KEY (requirement_id) REFERENCES requirements(id) ON DELETE SET NULL,
    FOREIGN KEY (execution_id) REFERENCES executions(id) ON DELETE SET NULL
);

-- API Collections
CREATE TABLE IF NOT EXISTS api_collections (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    source_type ENUM('swagger', 'curl', 'postman', 'raw') NOT NULL,
    content MEDIUMTEXT,
    project_key VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_key) REFERENCES projects(project_key)
);

-- Automation Scripts
CREATE TABLE IF NOT EXISTS automation_assets (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    script_type ENUM('playwright', 'restassured', 'postman') NOT NULL,
    content MEDIUMTEXT,
    testcase_id INT,
    requirement_id INT,
    project_key VARCHAR(10) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (project_key) REFERENCES projects(project_key),
    FOREIGN KEY (testcase_id) REFERENCES testcases(id) ON DELETE SET NULL,
    FOREIGN KEY (requirement_id) REFERENCES requirements(id) ON DELETE SET NULL
);

-- Initalize sample projects
INSERT IGNORE INTO projects (project_key, name, description) VALUES
('TCGB', 'TCGen Buddy Core', 'Main development project for TCGen-Buddy'),
('TCA', 'Test Central App', 'External application under test'),
('AUTH', 'Authentication Service', 'Auth module for enterprise QA'),
('PAY', 'Payment Gateway', 'Sensitive payment processing modules');
