Feature: Contract Risk Analyzer
  As a legal operations manager
  I want to analyze contract documents for legal and operational risks
  So that I can identify high-risk clauses and summarize key concerns

  Scenario: Successful end-to-end contract risk analysis
    Given a contract file named "service_agreement.docx" exists in the workspace
    When the Orchestrator initiates the analysis workflow
    Then the Ingestion Agent should extract the raw text from the document
    And the Segmentation Agent should split the text into 12 logical clauses
    And the Risk Analysis Agent should classify and score each clause against the rubric
    And the Summary Agent should compute an overall contract risk score of 5.8
    And the Visualization Agent should generate a risk distribution bar chart
    And the Orchestrator should output a valid JSON report conforming to the clause schema

  Scenario: Ingesting an unsupported file format
    Given a contract file named "malicious_script.sh" exists in the workspace
    When the Ingestion Agent attempts to extract text
    Then the system should raise an ingestion error
    And the Orchestrator should return an error message indicating "Unsupported file format"

  Scenario: Scoring an Indemnity clause
    Given a clause text: "Client agrees to indemnify and hold harmless Provider from any and all claims, damages, and expenses without limitation."
    When the Risk Analysis Agent scores the clause
    Then the assigned risk_category should be "Indemnity"
    And the assigned risk_level should be "High"
    And the score assigned should be 9
