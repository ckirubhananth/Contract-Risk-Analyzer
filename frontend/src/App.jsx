import React, { useState } from "react";
import { 
  Upload, 
  FileText, 
  AlertTriangle, 
  CheckCircle, 
  Search, 
  Clock, 
  Coins, 
  ChevronRight, 
  X,
  FileCheck,
  ShieldCheck,
  TrendingUp,
  Brain,
  Layers,
  PieChart
} from "lucide-react";

export default function App() {
  const [file, setFile] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [analysisState, setAnalysisState] = useState("idle"); // idle, analyzing, completed, error
  const [errorMsg, setErrorMsg] = useState("");
  const [activeTab, setActiveTab] = useState("all"); // all, High, Medium, Low
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedClause, setSelectedClause] = useState(null);
  const [showTrajectory, setShowTrajectory] = useState(false);
  
  // Results State
  const [results, setResults] = useState(null);

  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (selectedFile) => {
    const ext = selectedFile.name.split(".").pop().toLowerCase();
    if (!["pdf", "docx", "txt", "md"].includes(ext)) {
      setErrorMsg("Unsupported file format. Please upload PDF, DOCX, TXT, or MD.");
      setAnalysisState("error");
      return;
    }
    setFile(selectedFile);
    setErrorMsg("");
    uploadAndAnalyze(selectedFile);
  };

  const uploadAndAnalyze = async (selectedFile) => {
    setAnalysisState("analyzing");
    
    const formData = new FormData();
    formData.append("file", selectedFile);
    
    try {
      const apiBaseUrl = import.meta.env.DEV ? "http://127.0.0.1:8000" : "";
      const response = await fetch(`${apiBaseUrl}/api/analyze`, {
        method: "POST",
        body: formData,
      });
      
      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "Analysis failed.");
      }
      
      const data = await response.json();
      setResults(data);
      setAnalysisState("completed");
      if (data.clauses && data.clauses.length > 0) {
        setSelectedClause(data.clauses[0]);
      }
    } catch (err) {
      console.error(err);
      setErrorMsg(err.message || "An error occurred during analysis.");
      setAnalysisState("error");
    }
  };

  const getRiskColor = (level) => {
    switch (level) {
      case "High": return "var(--risk-high)";
      case "Medium": return "var(--risk-medium)";
      case "Low": return "var(--risk-low)";
      default: return "var(--text-muted)";
    }
  };

  const getRiskBg = (level) => {
    switch (level) {
      case "High": return "rgba(239, 68, 68, 0.15)";
      case "Medium": return "rgba(245, 158, 11, 0.15)";
      case "Low": return "rgba(16, 185, 129, 0.15)";
      default: return "rgba(255, 255, 255, 0.05)";
    }
  };

  const resetAnalyzer = () => {
    setFile(null);
    setResults(null);
    setAnalysisState("idle");
    setSelectedClause(null);
    setSearchTerm("");
    setActiveTab("all");
    setShowTrajectory(false);
  };

  // Filter clauses
  const filteredClauses = results?.clauses.filter((c) => {
    const matchesTab = activeTab === "all" || c.risk_level === activeTab;
    const matchesSearch = c.text.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          c.risk_category.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesTab && matchesSearch;
  }) || [];

  return (
    <div className="app-container">
      {/* Header */}
      <header className="app-header">
        <div className="header-brand">
          <Brain className="brand-logo" />
          <div>
            <h1>Contract Risk Analyzer</h1>
            <p>Agentic Multi-Agent Legal Audit Engine</p>
          </div>
        </div>
        
        {results && (
          <button className="btn-reset" onClick={resetAnalyzer}>
            Upload New Contract
          </button>
        )}
      </header>

      <main className="main-content">
        {/* Idle state (Upload Screen) */}
        {analysisState === "idle" && (
          <div className="upload-container">
            <div className="upload-card">
              <h2>Ingest Contract Document</h2>
              <p className="card-subtitle">Upload a PDF, DOCX, TXT, or MD contract to analyze legal exposure, category distributions, and risk heatmaps.</p>
              
              <div 
                className={`dropzone ${dragActive ? "drag-active" : ""}`}
                onDragEnter={handleDrag}
                onDragOver={handleDrag}
                onDragLeave={handleDrag}
                onDrop={handleDrop}
              >
                <Upload className="upload-icon" />
                <p className="drop-text">Drag and drop your file here, or <label htmlFor="file-select" className="file-label">browse</label></p>
                <input 
                  id="file-select" 
                  type="file" 
                  className="hidden-file-input" 
                  onChange={handleFileChange}
                  accept=".pdf,.docx,.txt,.md"
                />
                <span className="file-types">Supports PDF, DOCX, TXT, and MD up to 20MB</span>
              </div>
            </div>
          </div>
        )}

        {/* Analyzing / Loading State */}
        {analysisState === "analyzing" && (
          <div className="loading-container">
            <div className="loading-card">
              <div className="spinner"></div>
              <h2>Analyzing Contract Document...</h2>
              <p className="file-analyzing-name">Processing: {file?.name}</p>
              
              <div className="loading-steps">
                <div className="loading-step active">
                  <Layers className="step-icon spinner-small" />
                  <span>Segmenting contract into clause nodes...</span>
                </div>
                <div className="loading-step">
                  <Brain className="step-icon" />
                  <span>Evaluating risks against YAML rubric...</span>
                </div>
                <div className="loading-step">
                  <PieChart className="step-icon" />
                  <span>Compiling visualizations and summary...</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Error State */}
        {analysisState === "error" && (
          <div className="error-container">
            <div className="error-card">
              <AlertTriangle className="error-icon" />
              <h2>Analysis Failed</h2>
              <p className="error-text">{errorMsg || "An unexpected error occurred."}</p>
              <button className="btn-primary" onClick={resetAnalyzer}>
                Try Again
              </button>
            </div>
          </div>
        )}

        {/* Completed State (Dashboard) */}
        {analysisState === "completed" && results && (
          <div className="dashboard-grid">
            
            {/* Left Column: Summary & Metrics */}
            <div className="dashboard-sidebar">
              {/* Score card */}
              <div className="metric-card score-card">
                <h3>Overall Contract Risk</h3>
                <div className="score-value-container">
                  <span className="score-number">{results.overall_score}</span>
                  <span className="score-max">/ 9.00</span>
                </div>
                <div className="risk-level-tag" style={{
                  backgroundColor: getRiskBg(results.overall_score > 6 ? "High" : results.overall_score > 3.5 ? "Medium" : "Low"),
                  color: getRiskColor(results.overall_score > 6 ? "High" : results.overall_score > 3.5 ? "Medium" : "Low")
                }}>
                  {results.overall_score > 6 ? "High Risk" : results.overall_score > 3.5 ? "Medium Risk" : "Low Risk"}
                </div>
              </div>

              {/* Stats Grid */}
              <div className="stats-grid">
                <div className="stat-card">
                  <span className="stat-label">Total Clauses</span>
                  <span className="stat-value">{results.clauses.length}</span>
                </div>
                <div className="stat-card" style={{ borderLeft: "3px solid var(--risk-high)" }}>
                  <span className="stat-label">High Risk</span>
                  <span className="stat-value text-high">{results.clauses.filter(c => c.risk_level === "High").length}</span>
                </div>
                <div className="stat-card" style={{ borderLeft: "3px solid var(--risk-medium)" }}>
                  <span className="stat-label">Medium Risk</span>
                  <span className="stat-value text-medium">{results.clauses.filter(c => c.risk_level === "Medium").length}</span>
                </div>
                <div className="stat-card" style={{ borderLeft: "3px solid var(--risk-low)" }}>
                  <span className="stat-label">Low Risk</span>
                  <span className="stat-value text-low">{results.clauses.filter(c => c.risk_level === "Low").length}</span>
                </div>
              </div>

              {/* Summary panel */}
              <div className="summary-card">
                <h3>Executive Summary & Action Plan</h3>
                <div className="summary-content">
                  {results.summary.split("\n").map((line, i) => {
                    if (line.startsWith("#")) return null; // skip headers
                    if (line.startsWith("**Overall Contract Risk Score:**")) return null;
                    if (line.startsWith("##")) {
                      return <h4 key={i} className="summary-subheading">{line.replace(/##/g, "").trim()}</h4>;
                    }
                    if (line.startsWith("-")) {
                      return <p key={i} className="summary-bullet">{line.replace(/^-/g, "").trim()}</p>;
                    }
                    if (line.match(/^\d+\./)) {
                      return <p key={i} className="summary-number">{line.trim()}</p>;
                    }
                    return <p key={i} className="summary-para">{line}</p>;
                  })}
                </div>
              </div>

              {/* Toggle Observability */}
              <button 
                className={`btn-toggle-observability ${showTrajectory ? "active" : ""}`}
                onClick={() => setShowTrajectory(!showTrajectory)}
              >
                {showTrajectory ? "Hide Observability Traces" : "View Agent Trajectory Traces"}
              </button>
            </div>

            {/* Right Column / Center: Clause List / Trajectory */}
            <div className="dashboard-main">
              {showTrajectory ? (
                /* Trajectory Observability Log */
                <div className="trajectory-card">
                  <div className="trajectory-header">
                    <h3>Agent Trajectory Log</h3>
                    <span className="badge-purple">Session: {results.trajectory.session_id}</span>
                  </div>
                  
                  <div className="trajectory-timeline">
                    {results.trajectory.steps?.map((step) => (
                      <div key={step.step_number} className="timeline-node">
                        <div className="node-marker"></div>
                        <div className="node-content">
                          <div className="node-meta">
                            <h4>{step.agent_name}</h4>
                            <div className="node-stats">
                              <span className="stat-badge"><Clock size={12} /> {step.latency_ms}ms</span>
                            </div>
                          </div>
                          <p className="node-thought">"{step.thought}"</p>
                          <div className="node-action">
                            <strong>Action:</strong> <code>{step.action.tool_name}</code>
                            {Object.keys(step.action.arguments).length > 0 && (
                              <pre>{JSON.stringify(step.action.arguments, null, 2)}</pre>
                            )}
                          </div>
                          <div className="node-result">
                            <strong>Result:</strong>
                            <pre>{JSON.stringify(step.result, null, 2)}</pre>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="trajectory-footer">
                    <div className="footer-metric">
                      <Clock size={16} />
                      <span>Total Latency: {results.trajectory.metrics?.total_latency_ms}ms</span>
                    </div>
                    <div className="footer-metric">
                      <Coins size={16} />
                      <span>Tokens Checked: {results.trajectory.metrics?.total_tokens}</span>
                    </div>
                  </div>
                </div>
              ) : (
                /* Clause Heatmap & Interactive List */
                <div className="clauses-card">
                  <div className="clauses-header">
                    <h3>Segmented Contract Clauses</h3>
                    
                    {/* Search bar */}
                    <div className="search-bar">
                      <Search className="search-icon" size={16} />
                      <input 
                        type="text" 
                        placeholder="Search clauses or categories..." 
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                      />
                    </div>
                  </div>

                  {/* Filters */}
                  <div className="filter-tabs">
                    <button 
                      className={`tab-btn ${activeTab === "all" ? "active" : ""}`}
                      onClick={() => setActiveTab("all")}
                    >
                      All ({results.clauses.length})
                    </button>
                    <button 
                      className={`tab-btn ${activeTab === "High" ? "active" : ""}`}
                      onClick={() => setActiveTab("High")}
                      style={{ borderBottomColor: "var(--risk-high)" }}
                    >
                      High Risk ({results.clauses.filter(c => c.risk_level === "High").length})
                    </button>
                    <button 
                      className={`tab-btn ${activeTab === "Medium" ? "active" : ""}`}
                      onClick={() => setActiveTab("Medium")}
                      style={{ borderBottomColor: "var(--risk-medium)" }}
                    >
                      Medium Risk ({results.clauses.filter(c => c.risk_level === "Medium").length})
                    </button>
                    <button 
                      className={`tab-btn ${activeTab === "Low" ? "active" : ""}`}
                      onClick={() => setActiveTab("Low")}
                      style={{ borderBottomColor: "var(--risk-low)" }}
                    >
                      Low Risk ({results.clauses.filter(c => c.risk_level === "Low").length})
                    </button>
                  </div>

                  <div className="clauses-list-split">
                    {/* List */}
                    <div className="clauses-list">
                      {filteredClauses.length > 0 ? (
                        filteredClauses.map((c) => (
                          <div 
                            key={c.clause_id} 
                            className={`clause-card ${selectedClause?.clause_id === c.clause_id ? "selected" : ""}`}
                            onClick={() => setSelectedClause(c)}
                          >
                            <div className="clause-card-header">
                              <span className="clause-id-badge">{c.clause_id}</span>
                              <span className="clause-category-tag">{c.risk_category}</span>
                              <span className="clause-risk-badge" style={{
                                backgroundColor: getRiskBg(c.risk_level),
                                color: getRiskColor(c.risk_level)
                              }}>
                                {c.risk_level}
                              </span>
                            </div>
                            <p className="clause-excerpt">{c.text.substring(0, 110)}...</p>
                            <div className="clause-card-footer">
                              <span>Score: {c.score > 0 ? c.score : (c.risk_level === "High" ? 9 : c.risk_level === "Medium" ? 5 : 1)}/9</span>
                              <ChevronRight size={16} />
                            </div>
                          </div>
                        ))
                      ) : (
                        <div className="empty-clauses">
                          <FileText size={48} />
                          <p>No clauses match your active filters.</p>
                        </div>
                      )}
                    </div>

                    {/* Details Side Panel */}
                    {selectedClause && (
                      <div className="clause-details-panel">
                        <div className="details-header">
                          <h3>Clause Node: {selectedClause.clause_id}</h3>
                          <span className="clause-category-large">{selectedClause.risk_category}</span>
                        </div>

                        <div className="details-body">
                          <div className="details-section">
                            <h5>Original Clause Text</h5>
                            <div className="clause-text-box">
                              <p>"{selectedClause.text}"</p>
                            </div>
                          </div>

                          <div className="details-metrics-row">
                            <div className="detail-stat">
                              <span className="detail-stat-label">Assigned Level</span>
                              <span className="detail-stat-val" style={{ color: getRiskColor(selectedClause.risk_level) }}>
                                {selectedClause.risk_level}
                              </span>
                            </div>
                            <div className="detail-stat">
                              <span className="detail-stat-label">Risk Score</span>
                              <span className="detail-stat-val">
                                {selectedClause.score > 0 ? selectedClause.score : (selectedClause.risk_level === "High" ? 9 : selectedClause.risk_level === "Medium" ? 5 : 1)} / 9
                              </span>
                            </div>
                            <div className="detail-stat">
                              <span className="detail-stat-label">Analysis Confidence</span>
                              <span className="detail-stat-val">{Math.round(selectedClause.confidence * 100)}%</span>
                            </div>
                          </div>

                          <div className="details-section">
                            <h5>Audit & Explanation</h5>
                            <div className="details-explanation-box">
                              <p>{selectedClause.explanation}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
