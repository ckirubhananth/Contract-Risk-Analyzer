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
  const [progressPercent, setProgressPercent] = useState(0);
  const [statusText, setStatusText] = useState("");
  
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
    setProgressPercent(0);
    setStatusText("Uploading and extracting contract text...");
    
    const formData = new FormData();
    formData.append("file", selectedFile);
    
    try {
      const apiBaseUrl = import.meta.env.DEV ? "http://127.0.0.1:8000" : "";
      
      // Phase 1: Ingest contract
      const ingestResponse = await fetch(`${apiBaseUrl}/api/ingest`, {
        method: "POST",
        body: formData,
      });
      
      if (!ingestResponse.ok) {
        const errData = await ingestResponse.json();
        throw new Error(errData.detail || "Ingestion failed.");
      }
      
      const ingestData = await ingestResponse.json();
      const rawClauses = ingestData.clauses;
      const filename = ingestData.filename;
      let trajectorySteps = ingestData.steps;
      
      setProgressPercent(10);
      
      if (rawClauses.length === 0) {
        throw new Error("No clauses could be segmented from this document.");
      }
      
      // Phase 2: Sequential batch analysis (5 clauses per batch)
      const batchSize = 5;
      const totalClauses = rawClauses.length;
      const evaluatedClauses = [];
      
      const chunks = [];
      for (let i = 0; i < totalClauses; i += batchSize) {
        chunks.push(rawClauses.slice(i, i + batchSize));
      }
      
      const totalChunks = chunks.length;
      
      for (let i = 0; i < totalChunks; i++) {
        const chunk = chunks[i];
        const chunkStart = i * batchSize + 1;
        const chunkEnd = Math.min((i + 1) * batchSize, totalClauses);
        
        setStatusText(`Evaluating clauses ${chunkStart}-${chunkEnd} of ${totalClauses}...`);
        
        const batchResponse = await fetch(`${apiBaseUrl}/api/analyze-batch`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ clauses: chunk }),
        });
        
        if (!batchResponse.ok) {
          const errData = await batchResponse.json();
          throw new Error(errData.detail || "Batch analysis failed.");
        }
        
        const batchData = await batchResponse.json();
        evaluatedClauses.push(...batchData.clauses);
        
        // Add trajectory logs for this batch
        trajectorySteps.push({
          "step_number": 3 + i,
          "agent_name": `RiskAnalysisAgent-Batch${i+1}`,
          "thought": `Classifying and scoring clauses ${chunkStart} to ${chunkEnd} using Gemini.`,
          "action": {
            "tool_name": "gemini:analyze_batch",
            "arguments": { "clause_count": chunk.length }
          },
          "result": { "evaluated_count": batchData.clauses.length },
          "latency_ms": batchData.latency_ms
        });
        
        // Progress runs from 10% to 90%
        const percent = Math.round(10 + ((i + 1) / totalChunks) * 80);
        setProgressPercent(percent);
      }
      
      // Phase 3: Aggregation & Summarization
      setStatusText("Generating executive summary and visual charts...");
      setProgressPercent(95);
      
      const summaryResponse = await fetch(`${apiBaseUrl}/api/summarize`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          filename: filename,
          clauses: evaluatedClauses,
          trajectory_steps: trajectorySteps
        }),
      });
      
      if (!summaryResponse.ok) {
        const errData = await summaryResponse.json();
        throw new Error(errData.detail || "Aggregation failed.");
      }
      
      const finalData = await summaryResponse.json();
      setProgressPercent(100);
      setResults(finalData);
      setAnalysisState("completed");
      if (finalData.clauses && finalData.clauses.length > 0) {
        setSelectedClause(finalData.clauses[0]);
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
              
              <div className="progress-container" style={{ width: '100%', marginTop: '20px', marginBottom: '20px' }}>
                <div className="progress-bar-bg" style={{ width: '100%', height: '8px', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: '4px', overflow: 'hidden' }}>
                  <div className="progress-bar-fill" style={{ width: `${progressPercent}%`, height: '100%', backgroundColor: 'var(--accent-purple)', transition: 'width 0.3s ease', borderRadius: '4px', boxShadow: '0 0 8px var(--accent-purple-glow)' }}></div>
                </div>
                <div className="progress-status-row" style={{ display: 'flex', justifyContent: 'space-between', marginTop: '8px', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
                  <span>{statusText}</span>
                  <span style={{ fontWeight: 'bold', color: 'var(--accent-purple)' }}>{progressPercent}%</span>
                </div>
              </div>

              <div className="loading-steps">
                <div className={`loading-step ${progressPercent >= 10 ? "active" : ""}`}>
                  <Layers className={`step-icon ${progressPercent >= 10 && progressPercent < 90 ? "spinner-small" : ""}`} />
                  <span>Segmenting contract into clause nodes...</span>
                </div>
                <div className={`loading-step ${progressPercent >= 15 ? "active" : ""}`}>
                  <Brain className={`step-icon ${progressPercent >= 15 && progressPercent < 90 ? "spinner-small" : ""}`} />
                  <span>Evaluating risks against YAML rubric...</span>
                </div>
                <div className={`loading-step ${progressPercent >= 90 ? "active" : ""}`}>
                  <PieChart className={`step-icon ${progressPercent >= 90 && progressPercent < 100 ? "spinner-small" : ""}`} />
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
