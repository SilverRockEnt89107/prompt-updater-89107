// Retell Prompt Updater Worker with Interactive Flow Viewer & Editing
// Store RETELL_API_KEY, ADMIN_USERNAME, and ADMIN_PASSWORD as secrets

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const corsHeaders = {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    };

    if (request.method === 'OPTIONS') {
      return new Response(null, { headers: corsHeaders });
    }

    const authHeader = request.headers.get('Authorization');
    let isAuthed = false;
    if (authHeader && authHeader.startsWith('Basic ')) {
      const base64Credentials = authHeader.slice(6);
      const credentials = atob(base64Credentials);
      const [username, password] = credentials.split(':');
      isAuthed = (username === env.ADMIN_USERNAME && password === env.ADMIN_PASSWORD);
    }

    if (url.pathname === '/' && request.method === 'GET') {
      return new Response(getHTML(), { headers: { 'Content-Type': 'text/html', ...corsHeaders } });
    }

    if (url.pathname === '/api/agents' && request.method === 'GET') {
      if (!isAuthed) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      return await listAgents(env, corsHeaders);
    }

    if (url.pathname === '/api/agent' && request.method === 'GET') {
      if (!isAuthed) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      const agentId = url.searchParams.get('id');
      return await getAgent(env, agentId, corsHeaders);
    }

    if (url.pathname === '/api/update' && request.method === 'POST') {
      if (!isAuthed) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      return await updateAgent(request, env, corsHeaders);
    }

    if (url.pathname === '/api/publish' && request.method === 'POST') {
      if (!isAuthed) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      return await publishAgent(request, env, corsHeaders);
    }

    if (url.pathname === '/api/knowledge-bases' && request.method === 'GET') {
      if (!isAuthed) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      return await listKnowledgeBases(env, corsHeaders);
    }

    if (url.pathname === '/api/voices' && request.method === 'GET') {
      if (!isAuthed) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      return await listVoices(env, corsHeaders);
    }

    if (url.pathname === '/api/update-agent' && request.method === 'POST') {
      if (!isAuthed) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      return await updateAgentSettings(request, env, corsHeaders);
    }

    if (url.pathname === '/api/update-llm' && request.method === 'POST') {
      if (!isAuthed) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      return await updateRetellLLM(request, env, corsHeaders);
    }


if (url.pathname === '/api/pronunciation' && request.method === 'GET') {
  if (!isAuthed) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  const agentId = url.searchParams.get('agent_id');
  return await getPronunciation(env, agentId, corsHeaders);
}

if (url.pathname === '/api/pronunciation' && request.method === 'POST') {
  if (!isAuthed) return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  return await updatePronunciation(request, env, corsHeaders);
}

    return new Response('Not Found', { status: 404, headers: corsHeaders });
  },
};

async function listAgents(env, corsHeaders) {
  try {
    const response = await fetch('https://api.retellai.com/list-agents', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${env.RETELL_API_KEY}` },
    });
    if (!response.ok) {
      const error = await response.text();
      return new Response(JSON.stringify({ error: `Retell API error: ${error}` }), { status: response.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const agents = await response.json();
    const simplified = agents.map(a => ({
      agent_id: a.agent_id,
      agent_name: a.agent_name,
      version: a.version,
      is_published: a.is_published,
      response_engine_type: a.response_engine?.type,
      conversation_flow_id: a.response_engine?.conversation_flow_id,
      llm_id: a.response_engine?.llm_id,
    }));
    return new Response(JSON.stringify(simplified), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}

async function getAgent(env, agentId, corsHeaders) {
  try {
    const response = await fetch(`https://api.retellai.com/get-agent/${agentId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${env.RETELL_API_KEY}` },
    });
    if (!response.ok) {
      const error = await response.text();
      return new Response(JSON.stringify({ error: `Retell API error: ${error}` }), { status: response.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const agent = await response.json();
    
    // Fetch conversation flow for conversation-flow agents
    if (agent.response_engine?.type === 'conversation-flow' && agent.response_engine?.conversation_flow_id) {
      const flowResponse = await fetch(`https://api.retellai.com/get-conversation-flow/${agent.response_engine.conversation_flow_id}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${env.RETELL_API_KEY}` },
      });
      if (flowResponse.ok) {
        agent.conversation_flow = await flowResponse.json();
      }
    }
    
    // Fetch LLM details for retell-llm agents (single-prompt and multi-state)
    if (agent.response_engine?.type === 'retell-llm' && agent.response_engine?.llm_id) {
      const llmResponse = await fetch(`https://api.retellai.com/get-retell-llm/${agent.response_engine.llm_id}`, {
        method: 'GET',
        headers: { 'Authorization': `Bearer ${env.RETELL_API_KEY}` },
      });
      if (llmResponse.ok) {
        agent.retell_llm = await llmResponse.json();
      }
    }
    
    return new Response(JSON.stringify(agent), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}

async function updateAgent(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { agent_id, conversation_flow_id, update_data, version_description } = body;
    if (!conversation_flow_id || !update_data) {
      return new Response(JSON.stringify({ error: 'Missing conversation_flow_id or update_data' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const updateResponse = await fetch(`https://api.retellai.com/update-conversation-flow/${conversation_flow_id}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${env.RETELL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(update_data),
    });
    if (!updateResponse.ok) {
      const error = await updateResponse.text();
      return new Response(JSON.stringify({ error: `Failed to update conversation flow: ${error}` }), { status: updateResponse.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const updateResult = await updateResponse.json();
    if (version_description && agent_id) {
      await fetch(`https://api.retellai.com/update-agent/${agent_id}`, {
        method: 'PATCH',
        headers: { 'Authorization': `Bearer ${env.RETELL_API_KEY}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ version_description }),
      });
    }
    return new Response(JSON.stringify({ success: true, result: updateResult }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}

async function publishAgent(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { agent_id } = body;
    if (!agent_id) {
      return new Response(JSON.stringify({ error: 'Missing agent_id' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const publishResponse = await fetch(`https://api.retellai.com/publish-agent/${agent_id}`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${env.RETELL_API_KEY}`, 'Content-Type': 'application/json' },
    });
    if (!publishResponse.ok) {
      const error = await publishResponse.text();
      return new Response(JSON.stringify({ error: `Failed to publish: ${error}` }), { status: publishResponse.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const responseText = await publishResponse.text();
    let publishResult = {};
    if (responseText && responseText.trim()) {
      try { publishResult = JSON.parse(responseText); } catch (e) { publishResult = { message: responseText }; }
    }
    const agentResponse = await fetch(`https://api.retellai.com/get-agent/${agent_id}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${env.RETELL_API_KEY}` },
    });
    if (agentResponse.ok) {
      const agentData = await agentResponse.json();
      publishResult.version = agentData.version;
    }
    return new Response(JSON.stringify({ success: true, result: publishResult }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}

async function listKnowledgeBases(env, corsHeaders) {
  try {
    const response = await fetch('https://api.retellai.com/list-knowledge-bases', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${env.RETELL_API_KEY}` },
    });
    if (!response.ok) {
      const error = await response.text();
      return new Response(JSON.stringify({ error: `Retell API error: ${error}` }), { status: response.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const knowledgeBases = await response.json();
    return new Response(JSON.stringify(knowledgeBases), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}

async function listVoices(env, corsHeaders) {
  try {
    const response = await fetch('https://api.retellai.com/list-voices', {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${env.RETELL_API_KEY}` },
    });
    if (!response.ok) {
      const error = await response.text();
      return new Response(JSON.stringify({ error: `Retell API error: ${error}` }), { status: response.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const voices = await response.json();
    return new Response(JSON.stringify(voices), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}

async function updateAgentSettings(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { agent_id, settings } = body;
    if (!agent_id || !settings) {
      return new Response(JSON.stringify({ error: 'Missing agent_id or settings' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const response = await fetch(`https://api.retellai.com/update-agent/${agent_id}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${env.RETELL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(settings),
    });
    if (!response.ok) {
      const error = await response.text();
      return new Response(JSON.stringify({ error: `Failed to update agent: ${error}` }), { status: response.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const result = await response.json();
    return new Response(JSON.stringify({ success: true, result }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}

async function updateRetellLLM(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { llm_id, update_data } = body;
    if (!llm_id || !update_data) {
      return new Response(JSON.stringify({ error: 'Missing llm_id or update_data' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const response = await fetch(`https://api.retellai.com/update-retell-llm/${llm_id}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${env.RETELL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify(update_data),
    });
    if (!response.ok) {
      const error = await response.text();
      return new Response(JSON.stringify({ error: `Failed to update LLM: ${error}` }), { status: response.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const result = await response.json();
    return new Response(JSON.stringify({ success: true, result }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}


async function getPronunciation(env, agentId, corsHeaders) {
  try {
    if (!agentId) {
      return new Response(JSON.stringify({ error: 'Missing agent_id' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const response = await fetch(`https://api.retellai.com/get-agent/${agentId}`, {
      method: 'GET',
      headers: { 'Authorization': `Bearer ${env.RETELL_API_KEY}` },
    });
    if (!response.ok) {
      const error = await response.text();
      return new Response(JSON.stringify({ error: `Retell API error: ${error}` }), { status: response.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const agent = await response.json();
    return new Response(JSON.stringify({
      agent_id: agentId,
      voice_id: agent.voice_id || '',
      pronunciation_dictionary: agent.pronunciation_dictionary || [],
    }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}

async function updatePronunciation(request, env, corsHeaders) {
  try {
    const body = await request.json();
    const { agent_id, pronunciation_dictionary } = body;
    if (!agent_id || !pronunciation_dictionary) {
      return new Response(JSON.stringify({ error: 'Missing agent_id or pronunciation_dictionary' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const response = await fetch(`https://api.retellai.com/update-agent/${agent_id}`, {
      method: 'PATCH',
      headers: { 'Authorization': `Bearer ${env.RETELL_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ pronunciation_dictionary }),
    });
    if (!response.ok) {
      const error = await response.text();
      return new Response(JSON.stringify({ error: `Failed to update pronunciation: ${error}` }), { status: response.status, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }
    const result = await response.json();
    const stored_count = Array.isArray(result?.pronunciation_dictionary) ? result.pronunciation_dictionary.length : null;
    return new Response(JSON.stringify({ success: true, submitted_count: pronunciation_dictionary.length, stored_count, result }), { headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  }
}

function getHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Retell Prompt Updater</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 1400px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
    h1 { color: #333; }
    .card { background: white; border-radius: 8px; padding: 20px; margin-bottom: 20px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
    label { display: block; margin-bottom: 5px; font-weight: 600; color: #555; }
    input, select, textarea { width: 100%; padding: 10px; border: 1px solid #ddd; border-radius: 4px; margin-bottom: 15px; font-size: 14px; }
    textarea { font-family: 'Monaco', 'Menlo', monospace; font-size: 12px; min-height: 300px; }
    button { padding: 12px 24px; border: none; border-radius: 4px; cursor: pointer; font-size: 14px; font-weight: 600; margin-right: 10px; margin-bottom: 10px; }
    .btn-primary { background: #007bff; color: white; }
    .btn-primary:hover { background: #0056b3; }
    .btn-success { background: #28a745; color: white; }
    .btn-success:hover { background: #1e7e34; }
    .btn-warning { background: #ffc107; color: #333; }
    .btn-warning:hover { background: #d39e00; }
    .btn-secondary { background: #6c757d; color: white; }
    .btn-secondary:hover { background: #545b62; }
    .btn-info { background: #17a2b8; color: white; }
    .btn-info:hover { background: #138496; }
    button:disabled { opacity: 0.5; cursor: not-allowed; }
    .status { padding: 15px; border-radius: 4px; margin-top: 15px; display: none; }
    .status.success { background: #d4edda; color: #155724; display: block; }
    .status.error { background: #f8d7da; color: #721c24; display: block; }
    .status.info { background: #cce5ff; color: #004085; display: block; }
    .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
    @media (max-width: 900px) { .grid { grid-template-columns: 1fr; } }
    .agent-info { background: #f8f9fa; padding: 10px; border-radius: 4px; margin-bottom: 15px; font-size: 13px; }
    #login-section { max-width: 400px; margin: 100px auto; }
    .hidden { display: none !important; }
    .file-upload { border: 2px dashed #ddd; padding: 20px; text-align: center; border-radius: 4px; margin-bottom: 15px; cursor: pointer; }
    .file-upload:hover { border-color: #007bff; }
    .tabs { display: flex; border-bottom: 2px solid #ddd; margin-bottom: 15px; }
    .tab { padding: 10px 20px; cursor: pointer; border-bottom: 2px solid transparent; margin-bottom: -2px; }
    .tab.active { border-bottom-color: #007bff; color: #007bff; font-weight: 600; }
    .toggle-container { display: flex; align-items: center; gap: 10px; }
    .toggle-label { font-size: 14px; color: #555; }
    .toggle-label.active { font-weight: 600; color: #007bff; }
    .toggle-switch { position: relative; width: 50px; height: 26px; background: #007bff; border-radius: 13px; cursor: pointer; transition: background 0.3s; }
    .toggle-switch.off { background: #6c757d; }
    .toggle-switch::after { content: ''; position: absolute; top: 3px; left: 3px; width: 20px; height: 20px; background: white; border-radius: 50%; transition: transform 0.3s; }
    .toggle-switch.off::after { transform: translateX(24px); }
    
    /* Modal */
    .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); display: flex; justify-content: center; align-items: center; z-index: 1000; }
    .modal-content { background: white; border-radius: 12px; width: 95vw; height: 90vh; display: flex; flex-direction: column; overflow: hidden; }
    .modal-header { padding: 15px 20px; border-bottom: 1px solid #ddd; display: flex; justify-content: space-between; align-items: center; background: #f8f9fa; flex-wrap: wrap; gap: 10px; }
    .modal-header h2 { margin: 0; font-size: 18px; }
    .flow-legend { display: flex; gap: 15px; align-items: center; flex-wrap: wrap; }
    .legend-item { display: flex; align-items: center; gap: 5px; font-size: 12px; color: #555; }
    .legend-color { width: 16px; height: 16px; border-radius: 4px; border: 2px solid; }
    .legend-line { width: 20px; height: 0; border-bottom: 2px; border-color: #999; }
    .modal-close { background: none; border: none; font-size: 24px; cursor: pointer; padding: 0 10px; color: #666; }
    .modal-body { flex: 1; display: flex; overflow: hidden; }
    
    /* Version badge in modal - FIX 3 */
    .version-badge { 
      background: linear-gradient(135deg, #007bff, #0056b3); 
      color: white; 
      padding: 6px 16px; 
      border-radius: 20px; 
      font-size: 14px; 
      font-weight: 700; 
      letter-spacing: 0.5px;
      box-shadow: 0 2px 6px rgba(0,123,255,0.35);
      white-space: nowrap;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .version-badge .version-label { font-weight: 400; opacity: 0.85; font-size: 11px; text-transform: uppercase; }
    .version-badge.has-changes { background: linear-gradient(135deg, #ffc107, #d39e00); color: #333; box-shadow: 0 2px 6px rgba(255,193,7,0.35); }
    
    /* Left panel with tabs */
    .left-panel { flex: 1; display: flex; flex-direction: column; overflow: hidden; }
    .panel-tabs { display: flex; background: #f0f0f0; border-bottom: 1px solid #ddd; }
    .panel-tab { padding: 10px 20px; border: none; background: transparent; cursor: pointer; font-size: 13px; font-weight: 500; color: #555; border-bottom: 2px solid transparent; }
    .panel-tab:hover { background: #e8e8e8; }
    .panel-tab.active { background: white; color: #007bff; border-bottom-color: #007bff; }
    .panel-content { flex: 1; overflow: hidden; }
    
    /* Flow canvas */
    #flow-canvas { width: 100%; height: 100%; overflow: hidden; background: #fafafa; position: relative; cursor: grab; }
    #flow-canvas:active { cursor: grabbing; }
    #flow-container { position: absolute; transform-origin: 0 0; }
    .zoom-controls { position: absolute; bottom: 20px; right: 20px; display: flex; gap: 5px; background: white; padding: 5px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); }
    .zoom-btn { width: 36px; height: 36px; border: 1px solid #ddd; background: white; border-radius: 4px; cursor: pointer; font-size: 18px; display: flex; align-items: center; justify-content: center; }
    .zoom-btn:hover { background: #f0f0f0; }
    #flow-minimap { position: absolute; bottom: 20px; left: 20px; width: 180px; height: 120px; background: white; border: 1px solid #ddd; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); overflow: hidden; }
    #minimap-viewport { position: absolute; border: 2px solid #007bff; background: rgba(0,123,255,0.1); pointer-events: none; }
    
    /* Tools panel */
    .tools-panel { padding: 20px; overflow-y: auto; height: 100%; }
    .tool-card { background: #fff; border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin-bottom: 15px; cursor: pointer; }
    .tool-card:hover { border-color: #007bff; }
    .tool-card h4 { margin: 0 0 10px; color: #ff9800; }
    .tool-card .tool-url { font-family: monospace; font-size: 11px; background: #f5f5f5; padding: 8px; border-radius: 4px; word-break: break-all; }
    
    /* Global prompt panel */
    .global-panel { padding: 20px; height: 100%; overflow-y: auto; }
    .global-panel textarea { font-family: 'Monaco', 'Menlo', monospace; font-size: 13px; resize: vertical; }
    .global-panel .btn-row { margin-top: 15px; }
    
    /* Right panel - details */
    #node-details { width: 400px; border-left: 1px solid #ddd; display: flex; flex-direction: column; background: white; }
    #details-content { flex: 1; padding: 20px; overflow-y: auto; }
    #details-content h3 { margin-top: 0; color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px; }
    .detail-label { font-weight: 600; color: #555; margin-top: 15px; margin-bottom: 5px; font-size: 12px; text-transform: uppercase; }
    .detail-value { background: #f8f9fa; padding: 10px; border-radius: 4px; font-size: 13px; white-space: pre-wrap; word-break: break-word; max-height: 150px; overflow-y: auto; }
    .edge-list { list-style: none; padding: 0; margin: 0; }
    .edge-list li { background: #e3f2fd; padding: 8px; border-radius: 4px; margin-bottom: 5px; font-size: 12px; cursor: pointer; }
    .edge-list li:hover { background: #bbdefb; }
    .edit-textarea { width: 100%; min-height: 150px; font-family: 'Monaco', 'Menlo', monospace; font-size: 12px; padding: 10px; border: 1px solid #ddd; border-radius: 4px; resize: vertical; }
    .edit-textarea:focus { border-color: #007bff; outline: none; }
    #details-actions { padding: 15px 20px; border-top: 1px solid #ddd; background: #f8f9fa; }
    #details-actions button { width: 100%; margin-bottom: 10px; }
    #details-actions button:last-child { margin-bottom: 0; }
    #edit-status-container { padding: 0 20px 20px; }
    .edit-status { padding: 12px 15px; border-radius: 4px; font-size: 13px; font-weight: 600; text-align: center; }
    .edit-status.success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
    .edit-status.error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
    .edit-status.info { background: #cce5ff; color: #004085; border: 1px solid #b8daff; }
    
    /* Flow nodes */
    .flow-node { cursor: pointer; }
    .flow-node:hover { filter: brightness(0.95); }
    .flow-node.selected rect { stroke: #007bff !important; stroke-width: 3 !important; }
    .node-start rect { fill: #c8e6c9; stroke: #4caf50; }
    .node-end rect { fill: #ffcdd2; stroke: #f44336; }
    .node-conversation rect { fill: #e3f2fd; stroke: #2196f3; }
    .node-function rect { fill: #fff3e0; stroke: #ff9800; }
    .node-component rect { fill: #f3e5f5; stroke: #9c27b0; }
    .node-default rect { fill: #eceff1; stroke: #607d8b; }
    
    /* Edge highlighting on hover */
    .flow-edge { cursor: pointer; transition: stroke 0.15s, stroke-width 0.15s; }
    .flow-edge:hover { stroke: #dc3545 !important; stroke-width: 4 !important; }
    .flow-edge.selected { stroke: #dc3545 !important; stroke-width: 4 !important; }
    .flow-edge-skip { cursor: pointer; transition: stroke 0.15s, stroke-width 0.15s; }
    .flow-edge-skip:hover { stroke: #dc3545 !important; stroke-width: 4 !important; }
    .flow-edge-skip.selected { stroke: #dc3545 !important; stroke-width: 4 !important; }
    .flow-node.copy-selected rect { fill: #ff9800 !important; stroke: #e65100 !important; stroke-width: 3 !important; }

/* Main navigation tabs */
.main-tabs { display: flex; border-bottom: 3px solid #ddd; margin-bottom: 20px; gap: 5px; }
.main-tab { padding: 12px 24px; cursor: pointer; border: 2px solid transparent; border-bottom: none; border-radius: 8px 8px 0 0; font-size: 15px; font-weight: 600; color: #666; background: #f0f0f0; transition: all 0.2s; }
.main-tab:hover { background: #e0e0e0; }
.main-tab.active { background: white; color: #007bff; border-color: #ddd; border-bottom: 3px solid white; margin-bottom: -3px; }
/* Pronunciation table */
.pron-table { width: 100%; border-collapse: collapse; }
.pron-table th { text-align: left; padding: 10px; background: #f8f9fa; border-bottom: 2px solid #ddd; font-size: 13px; color: #555; }
.pron-table td { padding: 6px; border-bottom: 1px solid #eee; }
.btn-danger { background: #dc3545; color: white; border: none; border-radius: 4px; cursor: pointer; }
.btn-danger:hover { background: #c82333; }
/* Pronunciation stats */
.pron-stats { display: flex; gap: 15px; margin-bottom: 15px; }
.pron-stat-card { flex: 1; background: #f8f9fa; border: 1px solid #ddd; border-radius: 8px; padding: 12px; text-align: center; }
.pron-stat-card .stat-number { font-size: 24px; font-weight: 700; color: #007bff; }
.pron-stat-card .stat-label { font-size: 11px; color: #666; text-transform: uppercase; }
.voice-ok { background: #d4edda; color: #155724; padding: 8px 12px; border-radius: 4px; font-size: 13px; margin-bottom: 10px; }
.voice-warning { background: #fff3cd; color: #856404; padding: 8px 12px; border-radius: 4px; font-size: 13px; margin-bottom: 10px; }
  </style>
</head>
<body>
  <!-- Login Section -->
  <div id="login-section" class="card">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <img src="https://imagedelivery.net/0IgKVzK2bd4Xy57V_UcQpg/54038b4a-f0a1-47e2-6980-f2fcddcc5d00/public" alt="Logo" style="height: 80px;">
      <h1 style="margin: 0;">🔐 Login</h1>
      <img src="https://imagedelivery.net/0IgKVzK2bd4Xy57V_UcQpg/4ffa8ca2-1256-4991-4567-d8c9966af400/public" alt="Logo" style="height: 80px;">
    </div>
    <label>Username</label>
    <input type="text" id="username" placeholder="Enter username">
    <label>Password</label>
    <input type="password" id="password" placeholder="Enter password">
    <button class="btn-primary" id="login-btn">Login</button>
    <div id="login-status" class="status"></div>
  </div>

  <!-- Main App -->
  <div id="app-section" class="hidden">
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px;">
      <img src="https://imagedelivery.net/0IgKVzK2bd4Xy57V_UcQpg/54038b4a-f0a1-47e2-6980-f2fcddcc5d00/public" alt="Logo" style="height: 80px;">
      <h1 style="margin: 0;">🚀 Retell Prompt Updater</h1>
      <img src="https://imagedelivery.net/0IgKVzK2bd4Xy57V_UcQpg/4ffa8ca2-1256-4991-4567-d8c9966af400/public" alt="Logo" style="height: 80px;">
    </div>
    
    <div class="main-tabs">
      <div class="main-tab active" data-tab="prompts" onclick="switchMainTab('prompts')">📝 Prompts & Flow</div>
      <div class="main-tab" data-tab="pronunciation" onclick="switchMainTab('pronunciation')">🗣️ Pronunciation</div>
    </div>

    <div id="tab-prompts">
    
    <div class="card">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px;">
        <label style="margin-bottom: 0;">Select Agent</label>
        <div class="toggle-container">
          <span class="toggle-label active" id="label-deployed">Deployed Only</span>
          <div class="toggle-switch" id="version-toggle"></div>
          <span class="toggle-label" id="label-all">All Agents</span>
        </div>
      </div>
      <div style="position:relative; margin-bottom:8px;">
        <input type="text" id="agent-search" placeholder="🔍 Search agents..." style="width:100%; padding:9px 12px 9px 34px; border:1px solid #d1d5db; border-radius:8px; font-size:14px; outline:none; transition:border-color 0.2s, box-shadow 0.2s;" onfocus="this.style.borderColor='#3b82f6';this.style.boxShadow='0 0 0 3px rgba(59,130,246,0.15)'" onblur="this.style.borderColor='#d1d5db';this.style.boxShadow='none'">
        <span style="position:absolute; left:10px; top:50%; transform:translateY(-50%); color:#9ca3af; font-size:15px; pointer-events:none;">⌕</span>
      </div>
      <select id="agent-select" size="10" style="width:100%; border:1px solid #d1d5db; border-radius:8px; padding:4px; font-size:13.5px; cursor:pointer; background:#fff;"><option value="">-- Select an agent --</option></select>
      <div id="agent-search-count" style="font-size:12px; color:#6b7280; margin-top:4px; display:none;"></div>
      <div id="agent-info" class="agent-info hidden"></div>
      <button class="btn-info" id="flow-btn" disabled>🔀 View Call Flow</button>
    </div>

    <div class="grid">
      <div class="card">
        <h3>📤 Upload New Configuration</h3>
        <div class="tabs">
          <div class="tab active" id="tab-paste">Paste JSON</div>
          <div class="tab" id="tab-upload">Upload File</div>
        </div>
        <div id="paste-tab">
          <label>Paste Conversation Flow JSON</label>
          <textarea id="json-input" placeholder="Paste your conversation flow JSON here..."></textarea>
        </div>
        <div id="upload-tab" class="hidden">
          <div class="file-upload" id="file-upload-area">
            <p>📁 Click to upload JSON file</p>
            <p id="file-name" style="color: #007bff;"></p>
          </div>
          <input type="file" id="file-input" accept=".json" style="display:none">
        </div>
        <label>Version Description (optional)</label>
        <input type="text" id="version-desc" placeholder="e.g., Fixed message collection flow">
        <button class="btn-warning" id="update-btn" disabled>📝 Update Draft Only</button>
        <button class="btn-success" id="publish-btn" disabled>🚀 Update & Publish</button>
        <div id="update-status" class="status"></div>
      </div>

      <div class="card">
        <h3>📥 Current Configuration</h3>
        <button class="btn-secondary" id="download-btn" disabled>⬇️ Download Current JSON</button>
        <textarea id="current-config" readonly placeholder="Select an agent to view current configuration..."></textarea>
      </div>
    </div>
</div><!-- end tab-prompts -->
<div id="tab-pronunciation" class="hidden">
  <div class="card">
    <h3>🗣️ Pronunciation Manager</h3>
    <p style="color:#666;font-size:13px;margin-bottom:15px;">Manage pronunciation dictionaries for your agents. Works with 11Labs voices only.</p>
    <label>Select Agent</label>
    <select id="pron-agent-select" style="width:100%;padding:10px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;font-size:14px;">
      <option value="">-- Select an agent --</option>
    </select>
    <div id="pron-voice-status"></div>
    <div id="pron-stats" class="pron-stats hidden">
      <div class="pron-stat-card"><div class="stat-number" id="pron-count">0</div><div class="stat-label">Entries</div></div>
      <div class="pron-stat-card"><div class="stat-number" id="pron-voice">--</div><div class="stat-label">Voice Provider</div></div>
    </div>
    <div id="pron-editor" class="hidden">
      <div style="display:flex;gap:10px;flex-wrap:wrap;margin-bottom:15px;">
        <button class="btn-primary" id="add-pron-btn">➕ Add Entry</button>
        <button class="btn-success" id="save-pron-btn">💾 Save All</button>
        <button class="btn-info" id="load-template-btn">📋 Load Medical Template</button>
        <button class="btn-secondary" id="export-pron-btn">📤 Export JSON</button>
        <button class="btn-warning" id="clear-pron-btn">🗑️ Clear All</button>
      </div>
      <div style="margin-bottom:15px;">
        <label>Bulk Import (JSON array or CSV: word,phoneme per line)</label>
        <textarea id="bulk-import-input" style="width:100%;height:80px;font-family:monospace;font-size:12px;padding:8px;border:1px solid #ddd;border-radius:4px;" placeholder='[{"word":"HIPAA","alphabet":"ipa","phoneme":"ˈhɪpə"}] or CSV: HIPAA,ˈhɪpə'></textarea>
        <button class="btn-secondary" id="bulk-import-btn" style="margin-top:5px;">📥 Import</button>
      </div>
      <div id="pron-list"></div>
    </div>
    <div id="pron-status" class="status"></div>
  </div>
</div>

  </div>

  <!-- Flow Viewer Modal -->
  <div id="flow-modal" class="modal-overlay hidden">
    <div class="modal-content">
      <div class="modal-header">
        <h2>📊 <span id="flow-agent-name"></span></h2>
        <div class="flow-legend">
          <span class="legend-item"><span class="legend-color" style="background: #c8e6c9; border-color: #4caf50;"></span> Start</span>
          <span class="legend-item"><span class="legend-color" style="background: #ffcdd2; border-color: #f44336;"></span> End</span>
          <span class="legend-item"><span class="legend-color" style="background: #e3f2fd; border-color: #2196f3;"></span> Conversation</span>
          <span class="legend-item"><span class="legend-color" style="background: #fff3e0; border-color: #ff9800;"></span> Function</span>
          <span class="legend-item"><span class="legend-color" style="background: #f3e5f5; border-color: #9c27b0;"></span> Component</span>
        </div>
        <!-- FIX 3: Version badge clearly visible in top-right of modal -->
        <div style="display:flex;align-items:center;gap:10px;">
          <div class="version-badge" id="flow-version-badge">
            <span class="version-label">VER</span>
            <span id="flow-version-number"></span>
          </div>
          <button class="modal-close" id="modal-close">&times;</button>
        </div>
      </div>
      <div class="modal-body">
        <div class="left-panel">
          <div class="panel-tabs">
            <button class="panel-tab active" data-panel="flow">🔀 Flow</button>
            <button class="panel-tab" data-panel="tools">🔧 Tools</button>
            <button class="panel-tab" data-panel="global">📝 Global</button>
            <button class="panel-tab" data-panel="agent">🎙️ Agent</button>
            <button class="panel-tab" data-panel="actions">⚡ Actions</button>
          </div>
          <div class="panel-content">
            <div id="panel-flow" style="width:100%;height:100%;">
              <div id="flow-canvas">
                <div id="flow-container"><svg id="flow-svg"></svg></div>
                <div class="zoom-controls">
                  <button class="zoom-btn" id="zoom-in" title="Zoom In">+</button>
                  <button class="zoom-btn" id="zoom-out" title="Zoom Out">−</button>
                  <button class="zoom-btn" id="zoom-reset" title="Reset">⟲</button>
                  <button class="zoom-btn" id="zoom-fit" title="Fit">⛶</button>
                </div>
                <div id="flow-minimap"><svg id="minimap-svg"></svg><div id="minimap-viewport"></div></div>
              </div>
            </div>
            <div id="panel-tools" class="tools-panel hidden"></div>
            <div id="panel-global" class="global-panel hidden"></div>
            <div id="panel-agent" class="global-panel hidden"></div>
            <div id="panel-actions" class="global-panel hidden"></div>
          </div>
        </div>
        <div id="node-details">
          <div id="details-content"><h3>Node Details</h3><p style="color:#666;">Click on a node to view details</p></div>
          <div id="details-actions" class="hidden">
            <button class="btn-success" id="save-btn" disabled>💾 Save Changes</button>
            <button class="btn-warning" id="save-publish-btn" disabled>🚀 Save & Publish</button>
          </div>
          <div id="edit-status-container"></div>
        </div>
      </div>
    </div>
  </div>

  <script>
    // State
    let authToken = '';
    let currentAgent = null;
    let currentFlow = null;
    let editedFlow = null;
    let agentDetails = null;
    let showAllAgents = false;
    let flowZoom = 1;
    let panX = 0, panY = 0;
    let isPanning = false;
    let startPanX = 0, startPanY = 0;
    let svgWidth = 0, svgHeight = 0;
    let selectedNodeId = null;
    let hasChanges = false;
    let knowledgeBases = [];
    let voices = [];
    let allAgentsList = [];
    let selectedNodesForCopy = new Set();
    let copyMode = false;
    let editedLLM = null;
    let editorMode = 'conversation-flow'; // 'conversation-flow', 'multi-state', 'single-prompt'
    let selectedStateId = null;
    let pronunciationList = [];

    // DOM elements
    const $ = id => document.getElementById(id);

    // Initialize
    document.addEventListener('DOMContentLoaded', init);

    // ==================== FIX 2: Centralized hasChanges management ====================
    function setHasChanges(val) {
      hasChanges = val;
      updateSaveButtonStates();
      updateVersionBadge();
    }
    
    function updateSaveButtonStates() {
      // Flow viewer detail panel buttons
      const saveBtn = $('save-btn');
      const savePubBtn = $('save-publish-btn');
      if (saveBtn) saveBtn.disabled = !hasChanges;
      if (savePubBtn) savePubBtn.disabled = !hasChanges;
      
      // Global panel buttons (conversation-flow mode)
      const globalSave = $('global-save');
      const globalPublish = $('global-publish');
      if (globalSave) globalSave.disabled = !hasChanges;
      if (globalPublish) globalPublish.disabled = !hasChanges;
      
      // LLM save buttons (single-prompt / multi-state)
      const llmSave = $('llm-save');
      const llmSavePub = $('llm-save-publish');
      if (llmSave) llmSave.disabled = !hasChanges;
      if (llmSavePub) llmSavePub.disabled = !hasChanges;
      
      // LLM global panel buttons
      const llmGlobalSave = $('llm-global-save');
      const llmGlobalPub = $('llm-global-publish');
      if (llmGlobalSave) llmGlobalSave.disabled = !hasChanges;
      if (llmGlobalPub) llmGlobalPub.disabled = !hasChanges;
    }
    
    // ==================== FIX 3: Version badge updater ====================
    function updateVersionBadge() {
      const badge = $('flow-version-badge');
      const numEl = $('flow-version-number');
      if (!badge || !numEl) return;
      numEl.textContent = 'v' + (currentAgent?.version || '?');
      if (hasChanges) {
        badge.className = 'version-badge has-changes';
        badge.title = 'Unsaved changes - version will increment on publish';
      } else {
        badge.className = 'version-badge';
        badge.title = 'Current published version';
      }
    }

    function init() {
      // Login
      $('login-btn').addEventListener('click', login);
      $('username').addEventListener('keypress', e => { if (e.key === 'Enter') $('password').focus(); });
      $('password').addEventListener('keypress', e => { if (e.key === 'Enter') login(); });

      // Main app
      $('version-toggle').addEventListener('click', toggleVersionFilter);
      $('agent-select').addEventListener('change', loadAgent);
      $('agent-search').addEventListener('input', filterAgents);
      $('flow-btn').addEventListener('click', openFlowViewer);
      $('tab-paste').addEventListener('click', () => switchTab('paste'));
      $('tab-upload').addEventListener('click', () => switchTab('upload'));
      $('file-upload-area').addEventListener('click', () => $('file-input').click());
      $('file-input').addEventListener('change', handleFileUpload);
      $('update-btn').addEventListener('click', updateDraft);
      $('publish-btn').addEventListener('click', updateAndPublish);
      $('download-btn').addEventListener('click', downloadCurrent);

      // Modal
      $('modal-close').addEventListener('click', closeFlowViewer);
      $('flow-modal').addEventListener('click', e => { if (e.target.id === 'flow-modal') closeFlowViewer(); });
      document.addEventListener('keydown', e => { if (e.key === 'Escape') closeFlowViewer(); });

      // Panel tabs
      document.querySelectorAll('.panel-tab').forEach(tab => {
        tab.addEventListener('click', () => switchPanel(tab.dataset.panel));
      });

      // Zoom controls
      $('zoom-in').addEventListener('click', () => { flowZoom = Math.min(flowZoom + 0.2, 2); updateTransform(); });
      $('zoom-out').addEventListener('click', () => { flowZoom = Math.max(flowZoom - 0.2, 0.2); updateTransform(); });
      $('zoom-reset').addEventListener('click', () => { flowZoom = 1; panX = 0; panY = 0; updateTransform(); });
      $('zoom-fit').addEventListener('click', fitToScreen);

      // Save buttons
      $('save-btn').addEventListener('click', saveChanges);
      $('save-publish-btn').addEventListener('click', saveAndPublish);

      // Pan handlers
      const canvas = $('flow-canvas');
      canvas.addEventListener('mousedown', e => {
        if (e.target.closest('.flow-node') || e.target.closest('.zoom-controls') || e.target.closest('#flow-minimap')) return;
        isPanning = true;
        startPanX = e.clientX - panX;
        startPanY = e.clientY - panY;
      });
      canvas.addEventListener('mousemove', e => {
        if (!isPanning) return;
        panX = e.clientX - startPanX;
        panY = e.clientY - startPanY;
        updateTransform();
      });
      canvas.addEventListener('mouseup', () => { isPanning = false; });
      canvas.addEventListener('mouseleave', () => { isPanning = false; });
      canvas.addEventListener('wheel', e => {
        e.preventDefault();
        flowZoom = Math.max(0.2, Math.min(2, flowZoom + (e.deltaY > 0 ? -0.1 : 0.1)));
        updateTransform();
      });


// Pronunciation events
$('pron-agent-select').addEventListener('change', loadPronunciation);
$('add-pron-btn').addEventListener('click', addPronunciationEntry);
$('save-pron-btn').addEventListener('click', savePronunciation);
$('load-template-btn').addEventListener('click', loadMedicalTemplate);
$('clear-pron-btn').addEventListener('click', clearAllPronunciations);
$('export-pron-btn').addEventListener('click', exportPronunciation);
$('bulk-import-btn').addEventListener('click', bulkImportPronunciation);
    }

    // Auth
    async function login() {
      const username = $('username').value;
      const password = $('password').value;
      if (!username || !password) { showStatus('login-status', 'Please enter both fields', 'error'); return; }
      authToken = 'Basic ' + btoa(username + ':' + password);
      try {
        const res = await fetch('/api/agents', { headers: { 'Authorization': authToken } });
        if (res.ok) {
          $('login-section').classList.add('hidden');
          $('app-section').classList.remove('hidden');
          loadAgents();
          loadKnowledgeBases();
          loadVoices();
        } else {
          showStatus('login-status', 'Invalid credentials', 'error');
        }
      } catch (err) {
        showStatus('login-status', 'Connection error', 'error');
      }
    }

    async function loadKnowledgeBases() {
      try {
        const res = await fetch('/api/knowledge-bases', { headers: { 'Authorization': authToken } });
        if (res.ok) {
          knowledgeBases = await res.json();
        }
      } catch (err) {
        console.error('Failed to load knowledge bases:', err);
      }
    }

    async function loadVoices() {
      try {
        const res = await fetch('/api/voices', { headers: { 'Authorization': authToken } });
        if (res.ok) {
          voices = await res.json();
        }
      } catch (err) {
        console.error('Failed to load voices:', err);
      }
    }

    // Agents
    let displayedAgents = [];
    
    async function loadAgents() {
      try {
        const res = await fetch('/api/agents', { headers: { 'Authorization': authToken } });
        const agents = await res.json();
        allAgentsList = agents;
        const filtered = showAllAgents ? agents : agents.filter(a => a.is_published);
        filtered.sort((a, b) => a.agent_name.localeCompare(b.agent_name));
        displayedAgents = filtered;
        
        // Clear search when list reloads
        $('agent-search').value = '';
        $('agent-search-count').style.display = 'none';
        
        renderAgentList(filtered);
      } catch (err) { console.error(err); }
    }

    function renderAgentList(agents, preserveSelection) {
      const select = $('agent-select');
      const previousAgentId = preserveSelection ? currentAgent?.agent_id : (currentAgent?.agent_id || null);
      
      select.innerHTML = '';
      if (!agents.length) {
        const opt = document.createElement('option');
        opt.value = '';
        opt.textContent = 'No agents found';
        opt.disabled = true;
        select.appendChild(opt);
        return;
      }
      
      let newSelectedValue = '';
      agents.forEach(a => {
        const opt = document.createElement('option');
        opt.value = JSON.stringify(a);
        opt.textContent = a.agent_name + ' (v' + a.version + ') - ' + (a.is_published ? '✓ Deployed' : 'Draft');
        select.appendChild(opt);
        
        if (previousAgentId && a.agent_id === previousAgentId) {
          newSelectedValue = opt.value;
        }
      });
      
      if (newSelectedValue) {
        select.value = newSelectedValue;
        currentAgent = JSON.parse(newSelectedValue);
      } else if (!preserveSelection) {
        resetAgentUI();
      }
    }

    function filterAgents() {
      const query = $('agent-search').value.toLowerCase().trim();
      const countEl = $('agent-search-count');
      
      if (!query) {
        renderAgentList(displayedAgents, true);
        countEl.style.display = 'none';
        return;
      }
      
      const matches = displayedAgents.filter(a => a.agent_name.toLowerCase().includes(query));
      renderAgentList(matches, true);
      
      countEl.textContent = matches.length + ' of ' + displayedAgents.length + ' agents';
      countEl.style.display = 'block';
    }

    function resetAgentUI() {
      currentAgent = null;
      currentFlow = null;
      $('agent-info').classList.add('hidden');
      $('current-config').value = '';
      $('update-btn').disabled = true;
      $('publish-btn').disabled = true;
      $('download-btn').disabled = true;
      $('flow-btn').disabled = true;
    }

    async function loadAgent() {
      const val = $('agent-select').value;
      if (!val) { resetAgentUI(); return; }
      currentAgent = JSON.parse(val);
      try {
        const res = await fetch('/api/agent?id=' + currentAgent.agent_id, { headers: { 'Authorization': authToken } });
        const agent = await res.json();
        currentFlow = agent.conversation_flow;
        agentDetails = agent;
        
        if (agent.response_engine?.llm_id) {
          currentAgent.llm_id = agent.response_engine.llm_id;
        }
        
        // Detect agent type
        const engineType = agent.response_engine?.type;
        const hasStates = agent.retell_llm?.states && agent.retell_llm.states.length > 0;
        let agentTypeLabel = 'Unknown';
        let agentTypeIcon = '❓';
        
        if (engineType === 'conversation-flow') {
          agentTypeLabel = 'Conversation Flow';
          agentTypeIcon = '🔀';
        } else if (engineType === 'retell-llm') {
          if (hasStates) {
            agentTypeLabel = 'Multi-State';
            agentTypeIcon = '📊';
          } else {
            agentTypeLabel = 'Single Prompt';
            agentTypeIcon = '📝';
          }
        }
        
        $('agent-info').innerHTML = '<strong>ID:</strong> ' + currentAgent.agent_id + 
          '<br><strong>Version:</strong> ' + currentAgent.version + 
          '<br><strong>Status:</strong> ' + (currentAgent.is_published ? '✓ Deployed' : 'Draft') +
          '<br><strong>Type:</strong> ' + agentTypeIcon + ' ' + agentTypeLabel;
        $('agent-info').classList.remove('hidden');
        
        if (engineType === 'conversation-flow') {
          $('current-config').value = JSON.stringify(currentFlow, null, 2);
          $('update-btn').disabled = !currentAgent.conversation_flow_id;
          $('publish-btn').disabled = !currentAgent.conversation_flow_id;
          $('download-btn').disabled = !currentFlow;
          $('flow-btn').disabled = !currentFlow?.nodes;
          $('flow-btn').textContent = '🔀 View Call Flow';
        } else if (engineType === 'retell-llm') {
          $('current-config').value = JSON.stringify(agent.retell_llm, null, 2);
          $('update-btn').disabled = !currentAgent.llm_id;
          $('publish-btn').disabled = !currentAgent.llm_id;
          $('download-btn').disabled = !agent.retell_llm;
          $('flow-btn').disabled = false;
          $('flow-btn').textContent = hasStates ? '📊 View States' : '📝 Edit Prompt';
        }
      } catch (err) { 
        console.error('Load agent error:', err);
        showStatus('update-status', 'Failed to load agent', 'error'); 
      }
    }

    function toggleVersionFilter() {
      showAllAgents = !showAllAgents;
      $('version-toggle').classList.toggle('off', showAllAgents);
      $('label-deployed').classList.toggle('active', !showAllAgents);
      $('label-all').classList.toggle('active', showAllAgents);
      loadAgents();
    }

    // Tabs
    function switchTab(tab) {
      $('tab-paste').classList.toggle('active', tab === 'paste');
      $('tab-upload').classList.toggle('active', tab === 'upload');
      $('paste-tab').classList.toggle('hidden', tab !== 'paste');
      $('upload-tab').classList.toggle('hidden', tab !== 'upload');
    }

    function handleFileUpload(e) {
      const file = e.target.files[0];
      if (file) {
        $('file-name').textContent = file.name;
        const reader = new FileReader();
        reader.onload = ev => { $('json-input').value = ev.target.result; };
        reader.readAsText(file);
      }
    }

    // Update/Publish (main page buttons)
    async function updateDraft() {
      if (!currentAgent?.conversation_flow_id) return;
      try {
        const data = getUpdateData();
        showStatus('update-status', 'Updating...', 'info');
        const res = await fetch('/api/update', {
          method: 'POST',
          headers: { 'Authorization': authToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent_id: currentAgent.agent_id,
            conversation_flow_id: currentAgent.conversation_flow_id,
            update_data: data,
            version_description: $('version-desc').value
          })
        });
        const result = await res.json();
        if (result.success) {
          showStatus('update-status', '✅ Draft updated!', 'success');
          loadAgent();
        } else {
          showStatus('update-status', '❌ ' + result.error, 'error');
        }
      } catch (err) { showStatus('update-status', '❌ ' + err.message, 'error'); }
    }

    async function updateAndPublish() {
      if (!currentAgent?.conversation_flow_id) return;
      try {
        const data = getUpdateData();
        showStatus('update-status', 'Updating...', 'info');
        let res = await fetch('/api/update', {
          method: 'POST',
          headers: { 'Authorization': authToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            agent_id: currentAgent.agent_id,
            conversation_flow_id: currentAgent.conversation_flow_id,
            update_data: data,
            version_description: $('version-desc').value
          })
        });
        let result = await res.json();
        if (!result.success) { showStatus('update-status', '❌ ' + result.error, 'error'); return; }
        showStatus('update-status', 'Publishing...', 'info');
        res = await fetch('/api/publish', {
          method: 'POST',
          headers: { 'Authorization': authToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent_id: currentAgent.agent_id })
        });
        result = await res.json();
        if (result.success) {
          showStatus('update-status', '✅ Published! Version: ' + (result.result?.version || 'N/A'), 'success');
          loadAgents();
        } else {
          showStatus('update-status', '❌ ' + result.error, 'error');
        }
      } catch (err) { showStatus('update-status', '❌ ' + err.message, 'error'); }
    }

    function getUpdateData() {
      const text = $('json-input').value.trim();
      if (!text) throw new Error('Please paste or upload JSON');
      const parsed = JSON.parse(text);
      return parsed.conversationFlow || parsed;
    }

    function downloadCurrent() {
      if (!currentFlow) return;
      const blob = new Blob([JSON.stringify(currentFlow, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = (currentAgent?.agent_name || 'flow') + '_v' + (currentAgent?.version || '0') + '.json';
      a.click();
    }

    function showStatus(id, msg, type) {
      const el = $(id);
      el.textContent = msg;
      el.className = 'status ' + type;
    }

    // Flow Viewer
    function openFlowViewer() {
      const engineType = agentDetails?.response_engine?.type;
      const hasStates = agentDetails?.retell_llm?.states && agentDetails.retell_llm.states.length > 0;
      
      if (engineType === 'conversation-flow') {
        if (!currentFlow?.nodes) return;
        editedFlow = JSON.parse(JSON.stringify(currentFlow));
        editorMode = 'conversation-flow';
      } else if (engineType === 'retell-llm') {
        if (!agentDetails?.retell_llm) {
          alert('Could not load LLM data. Check console for details.');
          return;
        }
        editedLLM = JSON.parse(JSON.stringify(agentDetails.retell_llm));
        editorMode = hasStates ? 'multi-state' : 'single-prompt';
      } else {
        alert('Unknown agent type: ' + engineType);
        return;
      }
      
      // FIX 2: Start with no changes
      setHasChanges(false);
      $('flow-modal').classList.remove('hidden');
      $('flow-agent-name').textContent = currentAgent.agent_name + ' (v' + currentAgent.version + ')';
      
      // FIX 3: Set version badge
      updateVersionBadge();
      
      document.body.style.overflow = 'hidden';
      panX = 0; panY = 0; flowZoom = 0.8;
      
      updateEditorTabs();
      
      if (editorMode === 'conversation-flow') {
        switchPanel('flow');
        renderFlow();
        renderToolsPanel();
        renderGlobalPanel();
        renderAgentPanel();
        setTimeout(fitToScreen, 100);
      } else if (editorMode === 'multi-state') {
        switchPanel('flow');
        renderMultiStateFlow();
        renderLLMToolsPanel();
        renderLLMGlobalPanel();
        renderAgentPanel();
        setTimeout(fitToScreen, 100);
      } else if (editorMode === 'single-prompt') {
        switchPanel('global');
        renderSinglePromptPanel();
        renderLLMToolsPanel();
        renderAgentPanel();
      }
      
      // FIX 2: Ensure buttons start disabled
      updateSaveButtonStates();
    }
    
    function updateEditorTabs() {
      const tabsContainer = document.querySelector('.panel-tabs');
      if (editorMode === 'single-prompt') {
        tabsContainer.innerHTML = '<button class="panel-tab active" data-panel="global">📝 Prompt</button>' +
          '<button class="panel-tab" data-panel="tools">🔧 Tools</button>' +
          '<button class="panel-tab" data-panel="agent">🎙️ Agent</button>';
      } else if (editorMode === 'multi-state') {
        tabsContainer.innerHTML = '<button class="panel-tab active" data-panel="flow">📊 States</button>' +
          '<button class="panel-tab" data-panel="tools">🔧 Tools</button>' +
          '<button class="panel-tab" data-panel="global">📝 Global</button>' +
          '<button class="panel-tab" data-panel="agent">🎙️ Agent</button>' +
          '<button class="panel-tab" data-panel="actions">⚡ Actions</button>';
      } else {
        tabsContainer.innerHTML = '<button class="panel-tab active" data-panel="flow">🔀 Flow</button>' +
          '<button class="panel-tab" data-panel="tools">🔧 Tools</button>' +
          '<button class="panel-tab" data-panel="global">📝 Global</button>' +
          '<button class="panel-tab" data-panel="agent">🎙️ Agent</button>' +
          '<button class="panel-tab" data-panel="actions">⚡ Actions</button>';
      }
      tabsContainer.querySelectorAll('.panel-tab').forEach(t => {
        t.addEventListener('click', () => switchPanel(t.dataset.panel));
      });
    }

    function closeFlowViewer() {
      if (hasChanges && !confirm('You have unsaved changes. Close anyway?')) return;
      $('flow-modal').classList.add('hidden');
      document.body.style.overflow = '';
      editedFlow = null;
      editedLLM = null;
      editorMode = 'conversation-flow';
      selectedStateId = null;
      setHasChanges(false);
      
      // FIX 1: Refresh agent list so version numbers are current
      loadAgents();
      // Also reload the current agent details to sync everything
      if (currentAgent?.agent_id) {
        loadAgent();
      }
    }

    function switchPanel(panel) {
      document.querySelectorAll('.panel-tab').forEach(t => t.classList.toggle('active', t.dataset.panel === panel));
      $('panel-flow').classList.toggle('hidden', panel !== 'flow');
      $('panel-tools').classList.toggle('hidden', panel !== 'tools');
      $('panel-global').classList.toggle('hidden', panel !== 'global');
      $('panel-agent').classList.toggle('hidden', panel !== 'agent');
      $('panel-actions').classList.toggle('hidden', panel !== 'actions');
      if (panel === 'actions') renderActionsPanel();
      if (panel !== 'flow') {
        $('details-content').innerHTML = '<h3>Details</h3><p style="color:#666;">Select an item to view details</p>';
        $('details-actions').classList.add('hidden');
      }
      // FIX 2: Re-sync button states when switching panels
      updateSaveButtonStates();
    }

    // Render flow
    function renderFlow() {
      const svg = $('flow-svg');
      const nodes = editedFlow.nodes || [];
      const startNodeId = editedFlow.start_node_id;
      const nodeMap = {};
      nodes.forEach(n => nodeMap[n.id] = n);

      const nodeWidth = 160, nodeHeight = 50;
      const positions = {};
      const hasPos = nodes.some(n => n.display_position);

      if (hasPos) {
        let minX = Infinity, minY = Infinity;
        nodes.forEach(n => {
          if (n.display_position) {
            minX = Math.min(minX, n.display_position.x);
            minY = Math.min(minY, n.display_position.y);
          }
        });
        nodes.forEach(n => {
          if (n.display_position) {
            positions[n.id] = { x: (n.display_position.x - minX) * 0.35 + 80, y: (n.display_position.y - minY) * 0.35 + 80 };
          } else {
            positions[n.id] = { x: 80, y: Object.keys(positions).length * 150 + 80 };
          }
        });
      } else {
        const levels = {}, visited = new Set(), queue = [[startNodeId, 0]];
        while (queue.length) {
          const [id, lvl] = queue.shift();
          if (!id || visited.has(id) || !nodeMap[id]) continue;
          visited.add(id);
          if (!levels[lvl]) levels[lvl] = [];
          levels[lvl].push(id);
          const node = nodeMap[id];
          (node.edges || []).forEach(e => { if (e.destination_node_id && !visited.has(e.destination_node_id)) queue.push([e.destination_node_id, lvl + 1]); });
          if (node.skip_response_edge?.destination_node_id && !visited.has(node.skip_response_edge.destination_node_id)) queue.push([node.skip_response_edge.destination_node_id, lvl + 1]);
        }
        nodes.forEach(n => { if (!visited.has(n.id)) { const ml = Math.max(...Object.keys(levels).map(Number), 0) + 1; if (!levels[ml]) levels[ml] = []; levels[ml].push(n.id); } });
        Object.keys(levels).sort((a,b)=>a-b).forEach(l => {
          levels[l].forEach((id, i) => { positions[id] = { x: l * 300 + 80, y: i * 120 + 80 }; });
        });
      }

      let maxX = 0, maxY = 0;
      Object.values(positions).forEach(p => { maxX = Math.max(maxX, p.x + nodeWidth); maxY = Math.max(maxY, p.y + nodeHeight); });
      svgWidth = maxX + 100; svgHeight = maxY + 100;
      svg.setAttribute('width', svgWidth);
      svg.setAttribute('height', svgHeight);

      let content = '<defs><marker id="arrow" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#999"/></marker><marker id="arrow-green" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#28a745"/></marker><marker id="arrow-red" markerWidth="10" markerHeight="7" refX="9" refY="3.5" orient="auto"><polygon points="0 0,10 3.5,0 7" fill="#dc3545"/></marker></defs>';

      // Edges
      nodes.forEach(node => {
        const from = positions[node.id];
        if (!from) return;
        (node.edges || []).forEach((e, edgeIdx) => {
          const to = positions[e.destination_node_id];
          if (!to) return;
          const path = calcPath(from, to, nodeWidth, nodeHeight);
          const targetNode = nodes.find(n => n.id === e.destination_node_id);
          const targetName = targetNode ? (targetNode.name || targetNode.id) : e.destination_node_id;
          content += '<path class="flow-edge" data-from="' + node.id + '" data-to="' + e.destination_node_id + '" data-edge-idx="' + edgeIdx + '" d="' + path + '" fill="none" stroke="#999" stroke-width="2" marker-end="url(#arrow)"><title>' + escapeHtml(node.name || node.id) + ' -&gt; ' + escapeHtml(targetName) + '</title></path>';
        });
        if (node.skip_response_edge?.destination_node_id) {
          const to = positions[node.skip_response_edge.destination_node_id];
          if (to) {
            const path = calcPath(from, to, nodeWidth, nodeHeight);
            const targetNode = nodes.find(n => n.id === node.skip_response_edge.destination_node_id);
            const targetName = targetNode ? (targetNode.name || targetNode.id) : node.skip_response_edge.destination_node_id;
            content += '<path class="flow-edge-skip" data-from="' + node.id + '" data-to="' + node.skip_response_edge.destination_node_id + '" data-skip="true" d="' + path + '" fill="none" stroke="#28a745" stroke-width="2" stroke-dasharray="5,5" marker-end="url(#arrow-green)"><title>' + escapeHtml(node.name || node.id) + ' -&gt; ' + escapeHtml(targetName) + ' (skip)</title></path>';
          }
        }
      });

      // Nodes
      nodes.forEach(node => {
        const pos = positions[node.id];
        if (!pos) return;
        let cls = 'node-default';
        if (node.id === startNodeId) cls = 'node-start';
        else if (node.type === 'end') cls = 'node-end';
        else if (node.type === 'conversation') cls = 'node-conversation';
        else if (node.type === 'function') cls = 'node-function';
        else if (node.type === 'component') cls = 'node-component';
        
        const isCopySelected = selectedNodesForCopy.has(node.id);
        if (isCopySelected) cls += ' copy-selected';
        
        const name = (node.name || node.id).substring(0, 20) + ((node.name || node.id).length > 20 ? '...' : '');
        content += '<g class="flow-node ' + cls + '" data-id="' + node.id + '">';
        content += '<rect x="' + pos.x + '" y="' + pos.y + '" width="' + nodeWidth + '" height="' + nodeHeight + '" rx="6" stroke-width="2"/>';
        content += '<text x="' + (pos.x + nodeWidth/2) + '" y="' + (pos.y + 20) + '" text-anchor="middle" font-size="11" font-weight="600" fill="' + (isCopySelected ? '#fff' : '#333') + '">' + escapeHtml(name) + '</text>';
        content += '<text x="' + (pos.x + nodeWidth/2) + '" y="' + (pos.y + 36) + '" text-anchor="middle" font-size="9" fill="' + (isCopySelected ? '#ddd' : '#666') + '">' + (node.type || 'node') + '</text>';
        if (isCopySelected) content += '<text x="' + (pos.x + nodeWidth - 15) + '" y="' + (pos.y + 15) + '" font-size="14">✓</text>';
        content += '</g>';
      });

      svg.innerHTML = content;

      svg.querySelectorAll('.flow-node').forEach(el => {
        el.addEventListener('click', e => {
          e.stopPropagation();
          if (copyMode) {
            toggleNodeSelection(el.dataset.id);
          } else {
            selectNode(el.dataset.id);
          }
        });
      });

      renderMinimap(nodes, positions, nodeWidth, nodeHeight, startNodeId);
      updateTransform();
    }

    function calcPath(from, to, w, h) {
      const dx = to.x - from.x, dy = to.y - from.y;
      let fx, fy, tx, ty;
      if (Math.abs(dx) > Math.abs(dy)) {
        if (dx > 0) { fx = from.x + w; tx = to.x; } else { fx = from.x; tx = to.x + w; }
        fy = from.y + h/2; ty = to.y + h/2;
      } else {
        fx = from.x + w/2; tx = to.x + w/2;
        if (dy > 0) { fy = from.y + h; ty = to.y; } else { fy = from.y; ty = to.y + h; }
      }
      const mx = (fx + tx) / 2, my = (fy + ty) / 2;
      return 'M' + fx + ',' + fy + ' Q' + mx + ',' + fy + ' ' + mx + ',' + my + ' T' + tx + ',' + ty;
    }

    function renderMinimap(nodes, positions, w, h, startId) {
      const mini = $('minimap-svg');
      const scale = Math.min(180 / svgWidth, 120 / svgHeight) * 0.9;
      let content = '';
      nodes.forEach(n => {
        const p = positions[n.id];
        if (!p) return;
        let color = '#607d8b';
        if (n.id === startId) color = '#4caf50';
        else if (n.type === 'end') color = '#f44336';
        else if (n.type === 'conversation') color = '#2196f3';
        else if (n.type === 'function') color = '#ff9800';
        else if (n.type === 'component') color = '#9c27b0';
        content += '<rect x="' + (p.x * scale + 5) + '" y="' + (p.y * scale + 5) + '" width="' + (w * scale) + '" height="' + (h * scale) + '" fill="' + color + '" rx="2"/>';
      });
      mini.innerHTML = content;
    }

    function updateTransform() {
      $('flow-container').style.transform = 'translate(' + panX + 'px,' + panY + 'px) scale(' + flowZoom + ')';
      const canvas = $('flow-canvas');
      const vp = $('minimap-viewport');
      if (!svgWidth || !svgHeight) return;
      const scale = Math.min(180 / svgWidth, 120 / svgHeight) * 0.9;
      const vw = canvas.offsetWidth / flowZoom * scale;
      const vh = canvas.offsetHeight / flowZoom * scale;
      vp.style.width = vw + 'px';
      vp.style.height = vh + 'px';
      vp.style.left = (-panX / flowZoom * scale + 5) + 'px';
      vp.style.top = (-panY / flowZoom * scale + 5) + 'px';
    }

    function fitToScreen() {
      const canvas = $('flow-canvas');
      if (!svgWidth || !svgHeight) return;
      const pad = 40;
      flowZoom = Math.min((canvas.offsetWidth - pad*2) / svgWidth, (canvas.offsetHeight - pad*2) / svgHeight, 1);
      panX = (canvas.offsetWidth - svgWidth * flowZoom) / 2;
      panY = (canvas.offsetHeight - svgHeight * flowZoom) / 2;
      updateTransform();
    }

    // Select node
    function selectNode(nodeId) {
      selectedNodeId = nodeId;
      document.querySelectorAll('.flow-node').forEach(el => el.classList.toggle('selected', el.dataset.id === nodeId));
      const node = editedFlow.nodes.find(n => n.id === nodeId);
      if (!node) return;
      const nodeIndex = editedFlow.nodes.findIndex(n => n.id === nodeId);
      const isStartNode = nodeId === editedFlow.start_node_id;

      let html = '<h3>' + escapeHtml(node.name || node.id) + '</h3>';
      html += '<div class="detail-label">Type</div><div class="detail-value">' + (node.type || 'unknown') + (isStartNode ? ' <span style="color:#4caf50;font-weight:600;">(START NODE)</span>' : '') + '</div>';
      html += '<div class="detail-label">Node ID</div><div class="detail-value" style="font-size:10px;">' + node.id + '</div>';
      
      // BEGIN NODE SETTINGS (only for start node)
      if (isStartNode) {
        html += '<div style="background:#e8f5e9;border:2px solid #4caf50;border-radius:8px;padding:15px;margin:15px 0;">';
        html += '<div class="detail-label" style="color:#2e7d32;margin-top:0;">🚀 Begin Node Settings</div>';
        html += '<div class="detail-label">Who Speaks First</div>';
        html += '<select id="edit-begin-speaker" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:10px;">';
        html += '<option value="agent"' + (editedFlow.start_speaker !== 'user' ? ' selected' : '') + '>Agent speaks first</option>';
        html += '<option value="user"' + (editedFlow.start_speaker === 'user' ? ' selected' : '') + '>Wait for user to speak first</option>';
        html += '</select>';
        html += '<div id="begin-silence-section"' + (editedFlow.start_speaker !== 'user' ? ' style="display:none;"' : '') + '>';
        html += '<div class="detail-label">Begin After User Silence <span style="font-weight:normal;color:#888;">(ms)</span></div>';
        html += '<input type="number" id="edit-begin-silence" value="' + (editedFlow.begin_after_user_silence_ms || 2000) + '" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:10px;" placeholder="e.g., 2000">';
        html += '</div>';
        html += '<div class="detail-label">Greeting Message <span style="font-weight:normal;color:#888;">(agent first words)</span></div>';
        html += '<textarea id="edit-begin-greeting" class="edit-textarea" style="min-height:80px;">' + escapeHtml(node.instruction?.text || '') + '</textarea>';
        html += '</div>';
      }
      
      // Editable name
      html += '<div class="detail-label">Name</div>';
      html += '<input type="text" class="edit-textarea" style="min-height:auto;padding:8px;" id="edit-name" value="' + escapeHtml(node.name || '') + '">';

      // Type-specific content
      if (node.type === 'function') {
        const tool = (editedFlow.tools || []).find(t => t.tool_id === node.tool_id);
        if (tool) {
          html += '<div class="detail-label">🔧 Tool: ' + escapeHtml(tool.name || 'Unknown') + '</div>';
          html += '<div class="detail-value">';
          if (tool.url) html += '<strong>URL:</strong> ' + escapeHtml(tool.url) + '<br>';
          html += '<strong>Tool ID:</strong> ' + (node.tool_id || 'N/A');
          html += '</div>';
          if (tool.parameters?.properties) {
            html += '<div class="detail-label">Parameters</div><div class="detail-value" style="max-height:120px;">';
            Object.entries(tool.parameters.properties).forEach(([k, v]) => {
              html += '<strong>' + k + '</strong>' + (v.const ? ' = ' + v.const : '') + '<br>';
            });
            html += '</div>';
          }
        }
        html += '<div class="detail-label">Speak During Execution</div>';
        html += '<select id="edit-speak-during" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:10px;">';
        html += '<option value="true"' + (node.speak_during_execution !== false ? ' selected' : '') + '>Yes</option>';
        html += '<option value="false"' + (node.speak_during_execution === false ? ' selected' : '') + '>No</option>';
        html += '</select>';
        html += '<div class="detail-label">Message While Executing <span style="font-weight:normal;color:#888;">(optional)</span></div>';
        html += '<input type="text" class="edit-textarea" style="min-height:auto;padding:8px;" id="edit-speak-msg" value="' + escapeHtml(node.speak_during_execution_message || '') + '" placeholder="e.g., Please hold while I look that up...">';
        
        // Response Extraction Variables
        html += '<div class="detail-label">Response Extraction Variables</div>';
        html += '<div id="extraction-vars" style="background:#f8f9fa;padding:10px;border-radius:4px;margin-bottom:10px;border:1px solid #ddd;">';
        const extractVars = node.response_extraction?.variables || {};
        const extractEntries = Object.entries(extractVars);
        if (extractEntries.length === 0) {
          html += '<p id="no-extract-msg" style="color:#666;font-size:12px;margin:0 0 10px 0;">No extraction variables</p>';
        } else {
          extractEntries.forEach(([varName, config]) => {
            html += '<div class="extract-var-row" style="display:flex;gap:8px;margin-bottom:8px;">';
            html += '<input type="text" class="extract-var-name" value="' + escapeHtml(varName) + '" placeholder="Variable name" style="flex:1;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;">';
            html += '<input type="text" class="extract-var-desc" value="' + escapeHtml(config.description || '') + '" placeholder="Description" style="flex:2;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;">';
            html += '<button type="button" class="remove-extract-btn" style="padding:6px 10px;background:#dc3545;color:white;border:none;border-radius:4px;cursor:pointer;">✕</button>';
            html += '</div>';
          });
        }
        html += '<button type="button" id="add-extract-btn" style="padding:6px 12px;background:#28a745;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">+ Add Variable</button>';
        html += '</div>';
        
      } else if (node.type === 'component') {
        const comp = (editedFlow.components || []).find(c => c.component_id === node.component_id);
        if (comp) {
          html += '<div class="detail-label">📦 Component: ' + escapeHtml(comp.name || 'Unknown') + '</div>';
          if (comp.nodes) html += '<div class="detail-value">' + comp.nodes.length + ' nodes inside</div>';
        }
      } else if (!isStartNode) {
        if (node.instruction || node.type === 'conversation') {
          html += '<div class="detail-label">Prompt / Instructions</div>';
          html += '<textarea class="edit-textarea" id="edit-prompt" style="min-height:150px;">' + escapeHtml(node.instruction?.text || '') + '</textarea>';
        }
      }
      
      // NODE-LEVEL SETTINGS
      if (node.type === 'conversation' || node.type === 'end') {
        html += '<div style="border-top:1px solid #ddd;margin-top:15px;padding-top:15px;">';
        html += '<div class="detail-label" style="color:#007bff;">⚙️ Node-Level Overrides</div>';
        html += '<div class="detail-label">Knowledge Base <span style="font-weight:normal;color:#888;">(override global)</span></div>';
        html += '<select id="edit-node-kb" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:10px;">';
        html += '<option value="">Use global setting</option>';
        knowledgeBases.forEach(kb => {
          const isSelected = (node.knowledge_base_ids || []).includes(kb.knowledge_base_id);
          html += '<option value="' + kb.knowledge_base_id + '"' + (isSelected ? ' selected' : '') + '>' + escapeHtml(kb.knowledge_base_name || kb.knowledge_base_id) + '</option>';
        });
        html += '</select>';
        html += '<div class="detail-label">Model <span style="font-weight:normal;color:#888;">(override global)</span></div>';
        html += '<select id="edit-node-model" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:10px;">';
        html += '<option value="">Use global setting</option>';
        const models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'claude-3.5-sonnet', 'claude-3-haiku'];
        const nodeModel = node.model_choice?.model || '';
        models.forEach(m => {
          html += '<option value="' + m + '"' + (nodeModel === m ? ' selected' : '') + '>' + m + '</option>';
        });
        html += '</select>';
        html += '<div class="detail-label">Temperature <span style="font-weight:normal;color:#888;">(override global)</span></div>';
        const nodeTemp = node.model_temperature !== undefined ? node.model_temperature : '';
        html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;">';
        html += '<input type="range" id="edit-node-temp-slider" min="0" max="1" step="0.1" value="' + (nodeTemp || 0) + '" style="flex:1;cursor:pointer;">';
        html += '<input type="number" id="edit-node-temp" min="0" max="1" step="0.1" value="' + nodeTemp + '" placeholder="Global" style="width:70px;padding:5px;border:1px solid #ddd;border-radius:4px;text-align:center;font-size:12px;">';
        html += '</div>';
        html += '</div>';
      }

      // EDGES SECTION
      const edges = node.edges || [];
      html += '<div style="border-top:1px solid #ddd;margin-top:15px;padding-top:15px;">';
      html += '<div class="detail-label">Edges / Transitions (' + edges.length + ') <button type="button" id="add-edge-btn" style="float:right;padding:4px 10px;background:#28a745;color:white;border:none;border-radius:4px;cursor:pointer;font-size:11px;">+ Add Edge</button></div>';
      html += '<div id="edges-container">';
      if (edges.length === 0) {
        html += '<p style="color:#666;font-size:12px;">No edges configured</p>';
      } else {
        edges.forEach((e, edgeIdx) => {
          html += '<div class="edge-item" data-edge-index="' + edgeIdx + '" style="background:#f8f9fa;padding:10px;border-radius:4px;margin-bottom:10px;border:1px solid #ddd;">';
          html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
          html += '<strong style="color:#2196f3;">Edge ' + (edgeIdx + 1) + '</strong>';
          html += '<button type="button" class="remove-edge-btn" style="padding:4px 8px;background:#dc3545;color:white;border:none;border-radius:4px;cursor:pointer;font-size:11px;">✕ Remove</button>';
          html += '</div>';
          html += '<label style="font-size:11px;color:#666;">Destination Node:</label>';
          html += '<select class="edge-destination" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;margin-bottom:8px;font-size:12px;">';
          editedFlow.nodes.forEach(n => {
            if (n.id !== nodeId) {
              html += '<option value="' + n.id + '"' + (e.destination_node_id === n.id ? ' selected' : '') + '>' + escapeHtml(n.name || n.id) + '</option>';
            }
          });
          html += '</select>';
          html += '<label style="font-size:11px;color:#666;">Transition Condition:</label>';
          html += '<textarea class="edge-condition" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;min-height:60px;resize:vertical;">' + escapeHtml(e.transition_condition?.prompt || '') + '</textarea>';
          html += '<label style="font-size:11px;color:#666;margin-top:5px;display:block;">Description (optional):</label>';
          html += '<input type="text" class="edge-description" value="' + escapeHtml(e.description || '') + '" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;" placeholder="Brief description of this transition">';
          html += '</div>';
        });
      }
      html += '</div>';
      html += '</div>';
      
      // Skip response edge
      if (node.skip_response_edge) {
        html += '<div class="detail-label">Skip Response Edge</div>';
        html += '<div style="background:#e8f5e9;padding:10px;border-radius:4px;border:1px solid #4caf50;">';
        html += '<label style="font-size:11px;color:#666;">Destination:</label>';
        html += '<select id="skip-edge-destination" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;">';
        html += '<option value="">None (remove skip edge)</option>';
        editedFlow.nodes.forEach(n => {
          if (n.id !== nodeId) {
            html += '<option value="' + n.id + '"' + (node.skip_response_edge.destination_node_id === n.id ? ' selected' : '') + '>' + escapeHtml(n.name || n.id) + '</option>';
          }
        });
        html += '</select>';
        html += '</div>';
      } else {
        html += '<div class="detail-label">Skip Response Edge</div>';
        html += '<select id="add-skip-edge" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;">';
        html += '<option value="">No skip edge</option>';
        editedFlow.nodes.forEach(n => {
          if (n.id !== nodeId) {
            html += '<option value="' + n.id + '">' + escapeHtml(n.name || n.id) + '</option>';
          }
        });
        html += '</select>';
      }

      $('details-content').innerHTML = html;
      $('details-actions').classList.remove('hidden');
      // FIX 2: Update button states when showing details
      updateSaveButtonStates();

      // EVENT HANDLERS - all use setHasChanges(true) instead of hasChanges = true
      const beginSpeaker = $('edit-begin-speaker');
      if (beginSpeaker) {
        beginSpeaker.addEventListener('change', () => {
          editedFlow.start_speaker = beginSpeaker.value;
          const silenceSection = $('begin-silence-section');
          if (silenceSection) silenceSection.style.display = beginSpeaker.value === 'user' ? 'block' : 'none';
          setHasChanges(true);
        });
      }
      const beginSilence = $('edit-begin-silence');
      if (beginSilence) {
        beginSilence.addEventListener('input', () => {
          editedFlow.begin_after_user_silence_ms = parseInt(beginSilence.value) || 2000;
          setHasChanges(true);
        });
      }
      const beginGreeting = $('edit-begin-greeting');
      if (beginGreeting) {
        beginGreeting.addEventListener('input', () => {
          if (!editedFlow.nodes[nodeIndex].instruction) editedFlow.nodes[nodeIndex].instruction = { type: 'prompt', text: '' };
          editedFlow.nodes[nodeIndex].instruction.text = beginGreeting.value;
          setHasChanges(true);
        });
      }
      const nameInput = $('edit-name');
      if (nameInput) {
        nameInput.addEventListener('input', () => {
          editedFlow.nodes[nodeIndex].name = nameInput.value;
          setHasChanges(true);
        });
      }
      const promptInput = $('edit-prompt');
      if (promptInput) {
        promptInput.addEventListener('input', () => {
          if (!editedFlow.nodes[nodeIndex].instruction) editedFlow.nodes[nodeIndex].instruction = { type: 'prompt', text: '' };
          editedFlow.nodes[nodeIndex].instruction.text = promptInput.value;
          setHasChanges(true);
        });
      }
      const speakDuring = $('edit-speak-during');
      if (speakDuring) {
        speakDuring.addEventListener('change', () => {
          editedFlow.nodes[nodeIndex].speak_during_execution = speakDuring.value === 'true';
          setHasChanges(true);
        });
      }
      const speakMsg = $('edit-speak-msg');
      if (speakMsg) {
        speakMsg.addEventListener('input', () => {
          editedFlow.nodes[nodeIndex].speak_during_execution_message = speakMsg.value;
          setHasChanges(true);
        });
      }
      
      // Response extraction handlers
      function updateExtractionVars() {
        const vars = {};
        document.querySelectorAll('.extract-var-row').forEach(row => {
          const name = row.querySelector('.extract-var-name').value.trim();
          const desc = row.querySelector('.extract-var-desc').value;
          if (name) vars[name] = { type: 'string', description: desc };
        });
        if (!editedFlow.nodes[nodeIndex].response_extraction) editedFlow.nodes[nodeIndex].response_extraction = { variables: {} };
        editedFlow.nodes[nodeIndex].response_extraction.variables = vars;
        setHasChanges(true);
      }
      document.querySelectorAll('.extract-var-name, .extract-var-desc').forEach(input => { input.addEventListener('input', updateExtractionVars); });
      document.querySelectorAll('.remove-extract-btn').forEach(btn => {
        btn.addEventListener('click', function() { this.closest('.extract-var-row').remove(); updateExtractionVars(); });
      });
      const addExtractBtn = $('add-extract-btn');
      if (addExtractBtn) {
        addExtractBtn.addEventListener('click', function() {
          const container = $('extraction-vars');
          const noMsg = $('no-extract-msg');
          if (noMsg) noMsg.remove();
          const newRow = document.createElement('div');
          newRow.className = 'extract-var-row';
          newRow.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;';
          newRow.innerHTML = '<input type="text" class="extract-var-name" placeholder="Variable name" style="flex:1;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;">' +
            '<input type="text" class="extract-var-desc" placeholder="Description" style="flex:2;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;">' +
            '<button type="button" class="remove-extract-btn" style="padding:6px 10px;background:#dc3545;color:white;border:none;border-radius:4px;cursor:pointer;">✕</button>';
          container.insertBefore(newRow, addExtractBtn);
          newRow.querySelectorAll('.extract-var-name, .extract-var-desc').forEach(input => { input.addEventListener('input', updateExtractionVars); });
          newRow.querySelector('.remove-extract-btn').addEventListener('click', function() { this.closest('.extract-var-row').remove(); updateExtractionVars(); });
          setHasChanges(true);
        });
      }
      
      // Node-level override handlers
      const nodeKb = $('edit-node-kb');
      if (nodeKb) {
        nodeKb.addEventListener('change', () => {
          if (nodeKb.value) { editedFlow.nodes[nodeIndex].knowledge_base_ids = [nodeKb.value]; }
          else { delete editedFlow.nodes[nodeIndex].knowledge_base_ids; }
          setHasChanges(true);
        });
      }
      const nodeModelEl = $('edit-node-model');
      if (nodeModelEl) {
        nodeModelEl.addEventListener('change', () => {
          if (nodeModelEl.value) {
            if (!editedFlow.nodes[nodeIndex].model_choice) editedFlow.nodes[nodeIndex].model_choice = { type: 'cascading' };
            editedFlow.nodes[nodeIndex].model_choice.model = nodeModelEl.value;
          } else { delete editedFlow.nodes[nodeIndex].model_choice; }
          setHasChanges(true);
        });
      }
      const nodeTempSlider = $('edit-node-temp-slider');
      const nodeTempInput = $('edit-node-temp');
      if (nodeTempSlider && nodeTempInput) {
        nodeTempSlider.addEventListener('input', () => {
          nodeTempInput.value = nodeTempSlider.value;
          editedFlow.nodes[nodeIndex].model_temperature = parseFloat(nodeTempSlider.value);
          setHasChanges(true);
        });
        nodeTempInput.addEventListener('input', () => {
          if (nodeTempInput.value === '') { delete editedFlow.nodes[nodeIndex].model_temperature; nodeTempSlider.value = 0; }
          else {
            let val = parseFloat(nodeTempInput.value);
            if (isNaN(val)) val = 0; if (val < 0) val = 0; if (val > 1) val = 1;
            nodeTempSlider.value = val;
            editedFlow.nodes[nodeIndex].model_temperature = val;
          }
          setHasChanges(true);
        });
      }
      
      // Edge handlers
      function updateEdges() {
        const newEdges = [];
        document.querySelectorAll('.edge-item').forEach(item => {
          const dest = item.querySelector('.edge-destination').value;
          const cond = item.querySelector('.edge-condition').value;
          const desc = item.querySelector('.edge-description').value;
          if (dest) {
            const edge = { id: 'edge_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9), destination_node_id: dest, transition_condition: { type: 'prompt', prompt: cond } };
            if (desc) edge.description = desc;
            newEdges.push(edge);
          }
        });
        editedFlow.nodes[nodeIndex].edges = newEdges;
        setHasChanges(true);
      }
      document.querySelectorAll('.edge-destination, .edge-condition, .edge-description').forEach(el => {
        el.addEventListener('change', updateEdges);
        el.addEventListener('input', updateEdges);
      });
      document.querySelectorAll('.remove-edge-btn').forEach(btn => {
        btn.addEventListener('click', function() { this.closest('.edge-item').remove(); updateEdges(); });
      });
      const addEdgeBtn = $('add-edge-btn');
      if (addEdgeBtn) {
        addEdgeBtn.addEventListener('click', () => {
          const container = $('edges-container');
          const noEdgesMsg = container.querySelector('p');
          if (noEdgesMsg) noEdgesMsg.remove();
          const edgeIdx = document.querySelectorAll('.edge-item').length;
          const newEdge = document.createElement('div');
          newEdge.className = 'edge-item';
          newEdge.dataset.edgeIndex = edgeIdx;
          newEdge.style.cssText = 'background:#f8f9fa;padding:10px;border-radius:4px;margin-bottom:10px;border:1px solid #ddd;';
          let optionsHtml = '';
          editedFlow.nodes.forEach(n => { if (n.id !== nodeId) optionsHtml += '<option value="' + n.id + '">' + escapeHtml(n.name || n.id) + '</option>'; });
          newEdge.innerHTML = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;"><strong style="color:#2196f3;">New Edge</strong><button type="button" class="remove-edge-btn" style="padding:4px 8px;background:#dc3545;color:white;border:none;border-radius:4px;cursor:pointer;font-size:11px;">✕ Remove</button></div>' +
            '<label style="font-size:11px;color:#666;">Destination Node:</label><select class="edge-destination" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;margin-bottom:8px;font-size:12px;">' + optionsHtml + '</select>' +
            '<label style="font-size:11px;color:#666;">Transition Condition:</label><textarea class="edge-condition" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;min-height:60px;resize:vertical;" placeholder="When should this transition happen?"></textarea>' +
            '<label style="font-size:11px;color:#666;margin-top:5px;display:block;">Description (optional):</label><input type="text" class="edge-description" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;" placeholder="Brief description">';
          container.appendChild(newEdge);
          newEdge.querySelectorAll('.edge-destination, .edge-condition, .edge-description').forEach(el => { el.addEventListener('change', updateEdges); el.addEventListener('input', updateEdges); });
          newEdge.querySelector('.remove-edge-btn').addEventListener('click', function() { this.closest('.edge-item').remove(); updateEdges(); });
          updateEdges();
        });
      }
      
      // Skip edge handlers
      const skipEdgeDest = $('skip-edge-destination');
      if (skipEdgeDest) {
        skipEdgeDest.addEventListener('change', () => {
          if (skipEdgeDest.value) { editedFlow.nodes[nodeIndex].skip_response_edge = { destination_node_id: skipEdgeDest.value }; }
          else { delete editedFlow.nodes[nodeIndex].skip_response_edge; }
          setHasChanges(true);
        });
      }
      const addSkipEdge = $('add-skip-edge');
      if (addSkipEdge) {
        addSkipEdge.addEventListener('change', () => {
          if (addSkipEdge.value) {
            editedFlow.nodes[nodeIndex].skip_response_edge = { destination_node_id: addSkipEdge.value };
            setHasChanges(true);
            selectNode(nodeId);
          }
        });
      }
    }

    // Tools panel
    function renderToolsPanel() {
      const tools = editedFlow.tools || [];
      let html = '<h3>🔧 Tools (' + tools.length + ')</h3>';
      if (!tools.length) {
        html += '<p style="color:#666;">No tools configured.</p>';
      } else {
        tools.forEach((t, i) => {
          html += '<div class="tool-card" data-index="' + i + '">';
          html += '<h4>' + escapeHtml(t.name || 'Unnamed Tool') + '</h4>';
          html += '<div style="font-size:11px;color:#666;margin-bottom:5px;">ID: ' + t.tool_id + '</div>';
          if (t.url) html += '<div class="tool-url">' + escapeHtml(t.url) + '</div>';
          html += '</div>';
        });
      }
      $('panel-tools').innerHTML = html;
      document.querySelectorAll('.tool-card').forEach(card => {
        card.addEventListener('click', () => selectTool(parseInt(card.dataset.index)));
      });
    }

    function selectTool(index) {
      const tool = editedFlow.tools[index];
      if (!tool) return;
      let html = '<h3>🔧 ' + escapeHtml(tool.name || 'Tool') + '</h3>';
      html += '<div class="detail-label">Tool Name</div>';
      html += '<input type="text" class="edit-textarea" id="edit-tool-name" style="min-height:auto;padding:8px;" value="' + escapeHtml(tool.name || '') + '">';
      html += '<div class="detail-label">Tool ID</div><div class="detail-value" style="font-size:11px;">' + tool.tool_id + '</div>';
      html += '<div class="detail-label">Type</div><div class="detail-value">' + (tool.type || 'custom') + '</div>';
      html += '<div class="detail-label">Method</div>';
      html += '<select id="edit-tool-method" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
      ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'].forEach(m => {
        html += '<option value="' + m + '"' + ((tool.method || 'POST') === m ? ' selected' : '') + '>' + m + '</option>';
      });
      html += '</select>';
      html += '<div class="detail-label">URL</div>';
      html += '<textarea class="edit-textarea" id="edit-tool-url" style="min-height:60px;">' + escapeHtml(tool.url || '') + '</textarea>';
      
      // Headers
      html += '<div class="detail-label">Headers</div>';
      html += '<div id="headers-container" style="background:#f8f9fa;padding:10px;border-radius:4px;margin-bottom:15px;">';
      const headers = tool.headers || {};
      if (Object.keys(headers).length === 0) {
        html += '<p style="color:#666;font-size:12px;margin:0;">No headers configured</p>';
      } else {
        Object.entries(headers).forEach(([key, value]) => {
          html += '<div class="header-row" style="display:flex;gap:8px;margin-bottom:8px;">';
          html += '<input type="text" class="header-key" value="' + escapeHtml(key) + '" placeholder="Header name" style="flex:1;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;">';
          html += '<input type="text" class="header-value" value="' + escapeHtml(value) + '" placeholder="Value" style="flex:2;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;">';
          html += '<button type="button" class="remove-header-btn" style="padding:6px 10px;background:#dc3545;color:white;border:none;border-radius:4px;cursor:pointer;">✕</button>';
          html += '</div>';
        });
      }
      html += '<button type="button" id="add-header-btn" style="padding:6px 12px;background:#28a745;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">+ Add Header</button>';
      html += '</div>';
      
      html += '<div class="detail-label">Description</div>';
      html += '<textarea class="edit-textarea" id="edit-tool-desc" style="min-height:80px;">' + escapeHtml(tool.description || '') + '</textarea>';
      
      if (tool.parameters?.properties) {
        html += '<div class="detail-label">Parameters (' + Object.keys(tool.parameters.properties).length + ')</div>';
        Object.entries(tool.parameters.properties).forEach(([k, v]) => {
          html += '<div style="background:#f8f9fa;padding:12px;border-radius:4px;margin-bottom:10px;border:1px solid #e0e0e0;">';
          html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">';
          html += '<strong style="color:#333;">' + escapeHtml(k) + '</strong>';
          html += '<span style="font-size:11px;color:#888;background:#e9ecef;padding:2px 8px;border-radius:3px;">' + (v.type || 'string') + '</span>';
          html += '</div>';
          if (v.const !== undefined) {
            html += '<div style="font-size:12px;color:#28a745;background:#e8f5e9;padding:6px 8px;border-radius:3px;margin-bottom:8px;">⚡ Constant: ' + escapeHtml(String(v.const)) + '</div>';
          } else {
            html += '<div style="margin-bottom:8px;"><label style="font-size:11px;color:#666;">Default Value:</label>';
            html += '<input type="text" class="edit-textarea param-default" data-param="' + escapeHtml(k) + '" style="min-height:auto;padding:6px;margin-top:3px;" value="' + escapeHtml(v.default || '') + '"></div>';
          }
          html += '<div><label style="font-size:11px;color:#666;">Description:</label>';
          html += '<textarea class="edit-textarea param-desc" data-param="' + escapeHtml(k) + '" style="min-height:50px;margin-top:3px;">' + escapeHtml(v.description || '') + '</textarea></div>';
          html += '</div>';
        });
      }

      $('details-content').innerHTML = html;
      $('details-actions').classList.remove('hidden');
      updateSaveButtonStates();

      // Tool change handlers - all use setHasChanges
      const toolNameInput = $('edit-tool-name');
      const methodSelect = $('edit-tool-method');
      const urlInput = $('edit-tool-url');
      const descInput = $('edit-tool-desc');
      if (toolNameInput) toolNameInput.addEventListener('input', () => { editedFlow.tools[index].name = toolNameInput.value; setHasChanges(true); });
      if (methodSelect) methodSelect.addEventListener('change', () => { editedFlow.tools[index].method = methodSelect.value; setHasChanges(true); });
      if (urlInput) urlInput.addEventListener('input', () => { editedFlow.tools[index].url = urlInput.value; setHasChanges(true); });
      if (descInput) descInput.addEventListener('input', () => { editedFlow.tools[index].description = descInput.value; setHasChanges(true); });
      
      function updateHeaders() {
        const newHeaders = {};
        document.querySelectorAll('.header-row').forEach(row => {
          const key = row.querySelector('.header-key').value.trim();
          const value = row.querySelector('.header-value').value;
          if (key) newHeaders[key] = value;
        });
        editedFlow.tools[index].headers = newHeaders;
        setHasChanges(true);
      }
      document.querySelectorAll('.header-key, .header-value').forEach(input => { input.addEventListener('input', updateHeaders); });
      document.querySelectorAll('.remove-header-btn').forEach(btn => {
        btn.addEventListener('click', function() { this.closest('.header-row').remove(); updateHeaders(); });
      });
      $('add-header-btn').addEventListener('click', () => {
        const container = $('headers-container');
        const noHeadersMsg = container.querySelector('p');
        if (noHeadersMsg) noHeadersMsg.remove();
        const newRow = document.createElement('div');
        newRow.className = 'header-row';
        newRow.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;';
        newRow.innerHTML = '<input type="text" class="header-key" placeholder="Header name" style="flex:1;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;">' +
          '<input type="text" class="header-value" placeholder="Value" style="flex:2;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;">' +
          '<button type="button" class="remove-header-btn" style="padding:6px 10px;background:#dc3545;color:white;border:none;border-radius:4px;cursor:pointer;">✕</button>';
        container.insertBefore(newRow, $('add-header-btn'));
        newRow.querySelectorAll('.header-key, .header-value').forEach(input => { input.addEventListener('input', updateHeaders); });
        newRow.querySelector('.remove-header-btn').addEventListener('click', function() { this.closest('.header-row').remove(); updateHeaders(); });
        if (!editedFlow.tools[index].headers) editedFlow.tools[index].headers = {};
        setHasChanges(true);
      });
      document.querySelectorAll('.param-desc').forEach(textarea => {
        textarea.addEventListener('input', () => {
          const paramName = textarea.dataset.param;
          if (editedFlow.tools[index].parameters?.properties?.[paramName]) {
            editedFlow.tools[index].parameters.properties[paramName].description = textarea.value;
            setHasChanges(true);
          }
        });
      });
      document.querySelectorAll('.param-default').forEach(input => {
        input.addEventListener('input', () => {
          const paramName = input.dataset.param;
          if (editedFlow.tools[index].parameters?.properties?.[paramName]) {
            editedFlow.tools[index].parameters.properties[paramName].default = input.value;
            setHasChanges(true);
          }
        });
      });
    }

    // Global panel
    function renderGlobalPanel() {
      let html = '<h3 style="margin-top:0;">⚙️ Global Settings</h3>';
      html += '<div class="detail-label">Model</div>';
      const currentModel = editedFlow.model_choice?.model || editedFlow.model || 'gpt-4o';
      html += '<select id="edit-model" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
      const models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'claude-3.5-sonnet', 'claude-3-haiku'];
      models.forEach(m => { html += '<option value="' + m + '"' + (currentModel === m ? ' selected' : '') + '>' + m + '</option>'; });
      html += '</select>';
      html += '<div class="detail-label">Temperature <span style="font-weight:normal;color:#888;">(0 = deterministic, 1 = creative)</span></div>';
      const temp = editedFlow.model_temperature !== undefined ? editedFlow.model_temperature : 0;
      html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:15px;">';
      html += '<input type="range" id="edit-temperature" min="0" max="1" step="0.1" value="' + temp + '" style="flex:1;height:20px;cursor:pointer;">';
      html += '<input type="number" id="temp-value" min="0" max="1" step="0.1" value="' + temp + '" style="width:60px;padding:5px;border:1px solid #ddd;border-radius:4px;text-align:center;">';
      html += '</div>';
      html += '<div class="detail-label">Who Speaks First</div>';
      html += '<select id="edit-start-speaker" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
      html += '<option value="agent"' + (editedFlow.start_speaker !== 'user' ? ' selected' : '') + '>Agent speaks first</option>';
      html += '<option value="user"' + (editedFlow.start_speaker === 'user' ? ' selected' : '') + '>Wait for user to speak first</option>';
      html += '</select>';
      html += '<div id="silence-section"' + (editedFlow.start_speaker !== 'user' ? ' style="display:none;"' : '') + '>';
      html += '<div class="detail-label">Begin After User Silence <span style="font-weight:normal;color:#888;">(ms)</span></div>';
      html += '<input type="number" id="edit-silence-ms" value="' + (editedFlow.begin_after_user_silence_ms || 2000) + '" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;" placeholder="e.g., 2000">';
      html += '</div>';
      html += '<div class="detail-label">Tool Call Strict Mode</div>';
      html += '<select id="edit-strict-mode" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
      html += '<option value="false"' + (editedFlow.tool_call_strict_mode !== true ? ' selected' : '') + '>Off</option>';
      html += '<option value="true"' + (editedFlow.tool_call_strict_mode === true ? ' selected' : '') + '>On</option>';
      html += '</select>';
      
      // Knowledge Bases
      html += '<div class="detail-label">Knowledge Bases</div>';
      html += '<div id="kb-container" style="background:#f8f9fa;padding:10px;border-radius:4px;margin-bottom:15px;border:1px solid #ddd;">';
      const selectedKbs = editedFlow.knowledge_base_ids || [];
      if (knowledgeBases.length === 0) {
        html += '<p style="color:#666;font-size:12px;margin:0;">No knowledge bases available</p>';
      } else {
        knowledgeBases.forEach(kb => {
          const isChecked = selectedKbs.includes(kb.knowledge_base_id);
          html += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px solid #eee;">';
          html += '<input type="checkbox" class="kb-checkbox" value="' + kb.knowledge_base_id + '"' + (isChecked ? ' checked' : '') + ' style="width:18px;height:18px;cursor:pointer;">';
          html += '<div style="flex:1;"><div style="font-weight:500;">' + escapeHtml(kb.knowledge_base_name || kb.knowledge_base_id) + '</div><div style="font-size:10px;color:#888;">' + kb.knowledge_base_id + '</div></div>';
          const statusColor = kb.status === 'complete' ? '#28a745' : (kb.status === 'in_progress' ? '#ffc107' : '#dc3545');
          html += '<span style="font-size:10px;padding:2px 6px;background:' + statusColor + '20;color:' + statusColor + ';border-radius:3px;">' + (kb.status || 'unknown') + '</span>';
          html += '</div>';
        });
      }
      html += '</div>';
      
      // Dynamic Variables
      html += '<div class="detail-label">Default Dynamic Variables</div>';
      html += '<div id="dyn-vars-container" style="background:#f8f9fa;padding:10px;border-radius:4px;margin-bottom:15px;border:1px solid #ddd;">';
      const dynVars = editedFlow.default_dynamic_variables || {};
      const varEntries = Object.entries(dynVars);
      if (varEntries.length === 0) {
        html += '<p id="no-vars-msg" style="color:#666;font-size:12px;margin:0 0 10px 0;">No dynamic variables configured</p>';
      } else {
        varEntries.forEach(([key, value]) => {
          html += '<div class="dyn-var-row" style="display:flex;gap:8px;margin-bottom:8px;">';
          html += '<input type="text" class="var-key" value="' + escapeHtml(key) + '" placeholder="Variable name" style="flex:1;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;">';
          html += '<input type="text" class="var-value" value="' + escapeHtml(String(value)) + '" placeholder="Default value" style="flex:2;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;">';
          html += '<button type="button" class="remove-var-btn" style="padding:6px 10px;background:#dc3545;color:white;border:none;border-radius:4px;cursor:pointer;">✕</button>';
          html += '</div>';
        });
      }
      html += '<button type="button" id="add-var-btn" style="padding:6px 12px;background:#28a745;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">+ Add Variable</button>';
      html += '</div>';
      
      html += '<div class="detail-label">Global System Prompt</div>';
      html += '<textarea id="edit-global-prompt" class="edit-textarea" style="min-height:200px;">' + escapeHtml(editedFlow.global_prompt || '') + '</textarea>';
      
      // FIX 2: Save buttons with disabled state
      html += '<div style="margin-top:15px;padding-top:15px;border-top:1px solid #ddd;">';
      html += '<button class="btn-success" id="global-save" style="width:100%;margin-bottom:10px;" disabled>💾 Save Changes</button>';
      html += '<button class="btn-warning" id="global-publish" style="width:100%;" disabled>🚀 Save & Publish</button>';
      html += '</div>';
      
      $('panel-global').innerHTML = html;
      // FIX 2: Sync button states after rendering
      updateSaveButtonStates();
      
      // Event handlers - all use setHasChanges
      $('edit-model').addEventListener('change', function() {
        if (!editedFlow.model_choice) editedFlow.model_choice = { type: 'cascading' };
        editedFlow.model_choice.model = this.value;
        setHasChanges(true);
      });
      $('edit-temperature').addEventListener('input', function() {
        $('temp-value').value = this.value;
        editedFlow.model_temperature = parseFloat(this.value);
        setHasChanges(true);
      });
      $('temp-value').addEventListener('input', function() {
        let val = parseFloat(this.value);
        if (isNaN(val)) val = 0; if (val < 0) val = 0; if (val > 1) val = 1;
        $('edit-temperature').value = val;
        editedFlow.model_temperature = val;
        setHasChanges(true);
      });
      $('edit-start-speaker').addEventListener('change', function() {
        editedFlow.start_speaker = this.value;
        $('silence-section').style.display = this.value === 'user' ? 'block' : 'none';
        setHasChanges(true);
      });
      $('edit-silence-ms').addEventListener('input', function() { editedFlow.begin_after_user_silence_ms = parseInt(this.value) || 2000; setHasChanges(true); });
      $('edit-strict-mode').addEventListener('change', function() { editedFlow.tool_call_strict_mode = this.value === 'true'; setHasChanges(true); });
      document.querySelectorAll('.kb-checkbox').forEach(cb => {
        cb.addEventListener('change', function() {
          const selected = [];
          document.querySelectorAll('.kb-checkbox:checked').forEach(checked => { selected.push(checked.value); });
          editedFlow.knowledge_base_ids = selected;
          setHasChanges(true);
        });
      });
      
      function updateDynVars() {
        const newVars = {};
        document.querySelectorAll('.dyn-var-row').forEach(row => {
          const key = row.querySelector('.var-key').value.trim();
          const value = row.querySelector('.var-value').value;
          if (key) newVars[key] = value;
        });
        editedFlow.default_dynamic_variables = newVars;
        setHasChanges(true);
      }
      document.querySelectorAll('.var-key, .var-value').forEach(input => { input.addEventListener('input', updateDynVars); });
      document.querySelectorAll('.remove-var-btn').forEach(btn => {
        btn.addEventListener('click', function() { this.closest('.dyn-var-row').remove(); updateDynVars(); });
      });
      $('add-var-btn').addEventListener('click', function() {
        const container = $('dyn-vars-container');
        const noVarsMsg = $('no-vars-msg');
        if (noVarsMsg) noVarsMsg.remove();
        const newRow = document.createElement('div');
        newRow.className = 'dyn-var-row';
        newRow.style.cssText = 'display:flex;gap:8px;margin-bottom:8px;';
        newRow.innerHTML = '<input type="text" class="var-key" placeholder="Variable name" style="flex:1;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;">' +
          '<input type="text" class="var-value" placeholder="Default value" style="flex:2;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;">' +
          '<button type="button" class="remove-var-btn" style="padding:6px 10px;background:#dc3545;color:white;border:none;border-radius:4px;cursor:pointer;">✕</button>';
        container.insertBefore(newRow, $('add-var-btn'));
        newRow.querySelectorAll('.var-key, .var-value').forEach(input => { input.addEventListener('input', updateDynVars); });
        newRow.querySelector('.remove-var-btn').addEventListener('click', function() { this.closest('.dyn-var-row').remove(); updateDynVars(); });
        setHasChanges(true);
      });
      $('edit-global-prompt').addEventListener('input', function() { editedFlow.global_prompt = this.value; setHasChanges(true); });
      $('global-save').addEventListener('click', saveChanges);
      $('global-publish').addEventListener('click', saveAndPublish);
    }

    // ==================== SINGLE PROMPT EDITOR ====================
    function renderSinglePromptPanel() {
      let html = '<h3 style="margin-top:0;">📝 Single Prompt Agent</h3>';
      html += '<p style="font-size:12px;color:#666;margin-bottom:15px;">Edit the system prompt and settings for this agent.</p>';
      html += '<div class="detail-label">Model</div>';
      html += '<select id="llm-model" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
      const models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'claude-3.5-sonnet', 'claude-3.5-haiku'];
      models.forEach(m => { html += '<option value="' + m + '"' + (editedLLM.model === m ? ' selected' : '') + '>' + m + '</option>'; });
      html += '</select>';
      html += '<div class="detail-label">Temperature</div>';
      html += '<input type="number" id="llm-temperature" min="0" max="1" step="0.1" value="' + (editedLLM.general_temperature || 0) + '" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
      html += '<div class="detail-label">System Prompt</div>';
      html += '<textarea id="llm-general-prompt" style="width:100%;height:300px;font-family:monospace;font-size:12px;padding:10px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;resize:vertical;">' + escapeHtml(editedLLM.general_prompt || '') + '</textarea>';
      html += '<div class="detail-label">Begin Message (Agent First Words)</div>';
      html += '<textarea id="llm-begin-message" style="width:100%;height:60px;font-family:monospace;font-size:12px;padding:10px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;resize:vertical;">' + escapeHtml(editedLLM.begin_message || '') + '</textarea>';
      
      // Knowledge Bases
      html += '<div class="detail-label">Knowledge Bases</div>';
      html += '<div style="background:#f8f9fa;border:1px solid #e0e0e0;border-radius:8px;padding:12px;margin-bottom:15px;">';
      if (knowledgeBases.length === 0) {
        html += '<p style="color:#888;font-size:12px;margin:0;text-align:center;padding:10px;">No knowledge bases available</p>';
      } else {
        const selectedKBs = editedLLM.knowledge_base_ids || [];
        html += '<div style="max-height:180px;overflow-y:auto;">';
        knowledgeBases.forEach(kb => {
          const isChecked = selectedKBs.includes(kb.knowledge_base_id);
          const statusColor = kb.status === 'complete' ? '#28a745' : (kb.status === 'in_progress' ? '#ffc107' : '#dc3545');
          const statusIcon = kb.status === 'complete' ? '✓' : (kb.status === 'in_progress' ? '⏳' : '✗');
          html += '<label style="display:flex;align-items:center;gap:10px;padding:8px 10px;margin-bottom:4px;background:#fff;border-radius:6px;cursor:pointer;border:1px solid ' + (isChecked ? '#007bff' : '#e0e0e0') + ';transition:all 0.2s;">';
          html += '<input type="checkbox" class="llm-kb-checkbox" data-kb-id="' + kb.knowledge_base_id + '"' + (isChecked ? ' checked' : '') + ' style="width:16px;height:16px;cursor:pointer;">';
          html += '<div style="flex:1;min-width:0;"><div style="font-size:13px;font-weight:500;color:#333;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">' + escapeHtml(kb.knowledge_base_name) + '</div></div>';
          html += '<span style="font-size:11px;color:' + statusColor + ';font-weight:600;" title="' + (kb.status || 'unknown') + '">' + statusIcon + '</span>';
          html += '</label>';
        });
        html += '</div>';
        html += '<div style="margin-top:8px;padding-top:8px;border-top:1px solid #e0e0e0;font-size:11px;color:#888;">' + selectedKBs.length + ' of ' + knowledgeBases.length + ' selected</div>';
      }
      html += '</div>';
      
      // FIX 2: Save buttons start disabled
      html += '<div style="margin-top:20px;padding-top:15px;border-top:1px solid #eee;">';
      html += '<button id="llm-save" class="btn-success" style="margin-right:10px;" disabled>💾 Save Changes</button>';
      html += '<button id="llm-save-publish" class="btn-primary" disabled>🚀 Save & Publish</button>';
      html += '</div>';
      html += '<div id="llm-save-status" style="margin-top:10px;"></div>';
      
      $('panel-global').innerHTML = html;
      updateSaveButtonStates();
      
      $('llm-model').addEventListener('change', e => { editedLLM.model = e.target.value; setHasChanges(true); });
      $('llm-temperature').addEventListener('input', e => { editedLLM.general_temperature = parseFloat(e.target.value); setHasChanges(true); });
      $('llm-general-prompt').addEventListener('input', e => { editedLLM.general_prompt = e.target.value; setHasChanges(true); });
      $('llm-begin-message').addEventListener('input', e => { editedLLM.begin_message = e.target.value; setHasChanges(true); });
      document.querySelectorAll('.llm-kb-checkbox').forEach(cb => {
        cb.addEventListener('change', () => {
          const selectedKBs = [];
          document.querySelectorAll('.llm-kb-checkbox:checked').forEach(c => selectedKBs.push(c.dataset.kbId));
          editedLLM.knowledge_base_ids = selectedKBs;
          setHasChanges(true);
          renderSinglePromptPanel();
        });
      });
      $('llm-save').addEventListener('click', saveLLMChanges);
      $('llm-save-publish').addEventListener('click', saveLLMAndPublish);
    }
    
    // ==================== MULTI-STATE FLOW RENDERER ====================
    function renderMultiStateFlow() {
      const svg = $('flow-svg');
      const states = editedLLM.states || [];
      const startingState = editedLLM.starting_state;
      const nodeWidth = 160, nodeHeight = 50;
      const positions = {};
      const cols = Math.ceil(Math.sqrt(states.length));
      states.forEach((state, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        positions[state.name] = { x: 50 + col * 220, y: 50 + row * 120 };
      });
      let maxX = 0, maxY = 0;
      Object.values(positions).forEach(p => { maxX = Math.max(maxX, p.x + nodeWidth + 50); maxY = Math.max(maxY, p.y + nodeHeight + 50); });
      svgWidth = Math.max(maxX, 800);
      svgHeight = Math.max(maxY, 600);
      svg.setAttribute('viewBox', '0 0 ' + svgWidth + ' ' + svgHeight);
      
      let content = '<defs><marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" fill="#888"/></marker></defs>';
      states.forEach(state => {
        const fromPos = positions[state.name];
        if (!fromPos) return;
        (state.edges || []).forEach((edge) => {
          const toPos = positions[edge.destination_state_name];
          if (!toPos) return;
          const x1 = fromPos.x + nodeWidth, y1 = fromPos.y + nodeHeight / 2;
          const x2 = toPos.x, y2 = toPos.y + nodeHeight / 2;
          const midX = (x1 + x2) / 2;
          const path = 'M' + x1 + ',' + y1 + ' Q' + midX + ',' + y1 + ' ' + midX + ',' + (y1+y2)/2 + ' T' + x2 + ',' + y2;
          content += '<path class="flow-edge" d="' + path + '" fill="none" stroke="#888" stroke-width="2" marker-end="url(#arrow)"><title>' + escapeHtml(state.name) + ' -&gt; ' + escapeHtml(edge.destination_state_name) + '</title></path>';
        });
      });
      states.forEach(state => {
        const pos = positions[state.name];
        if (!pos) return;
        const isStart = state.name === startingState;
        const isSelected = selectedStateId === state.name;
        let cls = isStart ? 'node-start' : 'node-conversation';
        const name = state.name.substring(0, 18) + (state.name.length > 18 ? '...' : '');
        content += '<g class="flow-node ' + cls + '" data-state="' + escapeHtml(state.name) + '">';
        content += '<rect x="' + pos.x + '" y="' + pos.y + '" width="' + nodeWidth + '" height="' + nodeHeight + '" rx="6" stroke-width="' + (isSelected ? '3' : '2') + '"' + (isSelected ? ' stroke="#007bff"' : '') + '/>';
        content += '<text x="' + (pos.x + nodeWidth/2) + '" y="' + (pos.y + 20) + '" text-anchor="middle" font-size="11" font-weight="600" fill="#333">' + escapeHtml(name) + '</text>';
        content += '<text x="' + (pos.x + nodeWidth/2) + '" y="' + (pos.y + 36) + '" text-anchor="middle" font-size="9" fill="#666">' + (isStart ? '(start)' : 'state') + '</text>';
        content += '</g>';
      });
      svg.innerHTML = content;
      svg.querySelectorAll('.flow-node').forEach(el => {
        el.addEventListener('click', e => { e.stopPropagation(); selectState(el.dataset.state); });
      });
      renderMinimap(states.map(s => ({id: s.name, name: s.name})), positions, nodeWidth, nodeHeight, startingState);
      updateTransform();
    }
    
    function selectState(stateName) {
      selectedStateId = stateName;
      renderMultiStateFlow();
      renderStateDetails(stateName);
    }
    
    function renderStateDetails(stateName) {
      const state = editedLLM.states.find(s => s.name === stateName);
      if (!state) return;
      const isStart = stateName === editedLLM.starting_state;
      let html = '<h3 style="margin-top:0;">' + (isStart ? '🟢 ' : '📊 ') + escapeHtml(state.name) + '</h3>';
      html += '<p style="color:#666;font-size:12px;">' + (isStart ? 'Starting State' : 'State') + '</p>';
      html += '<div class="detail-label">State Name</div>';
      html += '<input type="text" id="edit-state-name" value="' + escapeHtml(state.name) + '" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
      if (!isStart) html += '<button id="set-starting-state" class="btn-secondary" style="margin-bottom:15px;">🟢 Set as Starting State</button>';
      html += '<div class="detail-label">State Prompt</div>';
      html += '<textarea id="edit-state-prompt" style="width:100%;height:200px;font-family:monospace;font-size:12px;padding:10px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;resize:vertical;">' + escapeHtml(state.state_prompt || '') + '</textarea>';
      html += '<div class="detail-label">Transitions to Other States</div>';
      html += '<div style="background:#f8f9fa;padding:10px;border-radius:4px;margin-bottom:15px;">';
      (state.edges || []).forEach((edge, idx) => {
        html += '<div style="display:flex;gap:8px;align-items:center;margin-bottom:8px;padding:8px;background:#fff;border-radius:4px;">';
        html += '<select class="state-edge-dest" data-idx="' + idx + '" style="flex:1;padding:6px;border:1px solid #ddd;border-radius:4px;">';
        editedLLM.states.forEach(s => {
          if (s.name !== stateName) html += '<option value="' + escapeHtml(s.name) + '"' + (edge.destination_state_name === s.name ? ' selected' : '') + '>' + escapeHtml(s.name) + '</option>';
        });
        html += '</select>';
        html += '<input type="text" class="state-edge-desc" data-idx="' + idx + '" placeholder="Condition/Description" value="' + escapeHtml(edge.description || '') + '" style="flex:2;padding:6px;border:1px solid #ddd;border-radius:4px;">';
        html += '<button class="btn-danger remove-state-edge" data-idx="' + idx + '" style="padding:6px 10px;">✕</button>';
        html += '</div>';
      });
      html += '<button id="add-state-edge" class="btn-secondary" style="width:100%;margin-top:5px;">+ Add Transition</button>';
      html += '</div>';
      const stateTools = state.tools || [];
      html += '<div class="detail-label">State-Specific Tools (' + stateTools.length + ')</div>';
      html += '<p style="font-size:11px;color:#666;">Tools specific to this state. Edit in Tools tab.</p>';
      
      $('details-content').innerHTML = html;
      $('details-actions').classList.add('hidden');
      
      $('edit-state-name').addEventListener('input', e => {
        const oldName = state.name;
        const newName = e.target.value;
        state.name = newName;
        editedLLM.states.forEach(s => { (s.edges || []).forEach(edge => { if (edge.destination_state_name === oldName) edge.destination_state_name = newName; }); });
        if (editedLLM.starting_state === oldName) editedLLM.starting_state = newName;
        selectedStateId = newName;
        setHasChanges(true);
        renderMultiStateFlow();
      });
      if ($('set-starting-state')) {
        $('set-starting-state').addEventListener('click', () => { editedLLM.starting_state = stateName; setHasChanges(true); renderMultiStateFlow(); renderStateDetails(stateName); });
      }
      $('edit-state-prompt').addEventListener('input', e => { state.state_prompt = e.target.value; setHasChanges(true); });
      document.querySelectorAll('.state-edge-dest').forEach(sel => {
        sel.addEventListener('change', e => { state.edges[parseInt(e.target.dataset.idx)].destination_state_name = e.target.value; setHasChanges(true); renderMultiStateFlow(); });
      });
      document.querySelectorAll('.state-edge-desc').forEach(inp => {
        inp.addEventListener('input', e => { state.edges[parseInt(e.target.dataset.idx)].description = e.target.value; setHasChanges(true); });
      });
      document.querySelectorAll('.remove-state-edge').forEach(btn => {
        btn.addEventListener('click', e => { state.edges.splice(parseInt(e.target.dataset.idx), 1); setHasChanges(true); renderMultiStateFlow(); renderStateDetails(stateName); });
      });
      $('add-state-edge').addEventListener('click', () => {
        if (!state.edges) state.edges = [];
        const otherStates = editedLLM.states.filter(s => s.name !== stateName);
        if (otherStates.length > 0) {
          state.edges.push({ destination_state_name: otherStates[0].name, description: '' });
          setHasChanges(true);
          renderMultiStateFlow();
          renderStateDetails(stateName);
        }
      });
    }
    
    // ==================== LLM TOOLS PANEL ====================
    function renderLLMToolsPanel() {
      let html = '<h3 style="margin-top:0;">🔧 Tools</h3>';
      const generalTools = editedLLM.general_tools || [];
      html += '<div class="detail-label">General Tools (available in all states)</div>';
      html += '<div id="general-tools-list" style="background:#f8f9fa;padding:10px;border-radius:4px;margin-bottom:10px;max-height:250px;overflow-y:auto;">';
      if (generalTools.length === 0) {
        html += '<p style="color:#666;font-size:12px;margin:0;">No general tools configured</p>';
      } else {
        generalTools.forEach((tool, idx) => { html += renderLLMToolItem(tool, idx, 'general'); });
      }
      html += '</div>';
      html += '<button id="add-general-tool" class="btn-secondary" style="width:100%;margin-bottom:20px;">+ Add General Tool</button>';
      if (editorMode === 'multi-state' && selectedStateId) {
        const state = editedLLM.states.find(s => s.name === selectedStateId);
        if (state) {
          const stateTools = state.tools || [];
          html += '<div class="detail-label">Tools for "' + escapeHtml(selectedStateId) + '" state</div>';
          html += '<div id="state-tools-list" style="background:#e3f2fd;padding:10px;border-radius:4px;margin-bottom:10px;max-height:200px;overflow-y:auto;">';
          if (stateTools.length === 0) { html += '<p style="color:#666;font-size:12px;margin:0;">No state-specific tools</p>'; }
          else { stateTools.forEach((tool, idx) => { html += renderLLMToolItem(tool, idx, 'state'); }); }
          html += '</div>';
          html += '<button id="add-state-tool" class="btn-secondary" style="width:100%;margin-bottom:15px;">+ Add Tool to "' + escapeHtml(selectedStateId) + '"</button>';
        }
      }
      html += '<div id="llm-tool-details" style="display:none;background:#fff;border:2px solid #007bff;border-radius:8px;padding:15px;margin-top:15px;"></div>';
      $('panel-tools').innerHTML = html;
      document.querySelectorAll('.llm-tool-item').forEach(item => {
        item.addEventListener('click', () => { selectLLMTool(parseInt(item.dataset.idx), item.dataset.scope); });
      });
      $('add-general-tool').addEventListener('click', () => addLLMTool('general'));
      if ($('add-state-tool')) $('add-state-tool').addEventListener('click', () => addLLMTool('state'));
    }
    
    function renderLLMToolItem(tool, idx, scope) {
      const toolType = tool.type || 'custom';
      const typeColors = { 'end_call': '#dc3545', 'transfer_call': '#28a745', 'custom': '#007bff', 'book_appointment_cal': '#6f42c1', 'check_calendar_availability': '#6f42c1', 'press_digit': '#fd7e14' };
      const color = typeColors[toolType] || '#6c757d';
      let html = '<div class="llm-tool-item" data-idx="' + idx + '" data-scope="' + scope + '" style="padding:10px;background:#fff;border-radius:4px;margin-bottom:8px;cursor:pointer;border:2px solid #ddd;transition:border-color 0.2s;">';
      html += '<div style="display:flex;justify-content:space-between;align-items:center;"><div>';
      html += '<div style="font-weight:600;">' + escapeHtml(tool.name || 'Unnamed Tool') + '</div>';
      html += '<div style="font-size:11px;color:' + color + ';font-weight:500;">' + toolType + '</div>';
      html += '</div><span style="color:#999;font-size:18px;">›</span></div></div>';
      return html;
    }
    
    let selectedLLMToolIdx = null;
    let selectedLLMToolScope = null;
    
    function selectLLMTool(idx, scope) {
      selectedLLMToolIdx = idx;
      selectedLLMToolScope = scope;
      const tool = scope === 'general' ? editedLLM.general_tools[idx] : editedLLM.states.find(s => s.name === selectedStateId).tools[idx];
      renderLLMToolDetails(tool, idx, scope);
      document.querySelectorAll('.llm-tool-item').forEach(item => { item.style.borderColor = '#ddd'; });
      const selected = document.querySelector('.llm-tool-item[data-idx="' + idx + '"][data-scope="' + scope + '"]');
      if (selected) selected.style.borderColor = '#007bff';
      $('llm-tool-details').style.display = 'block';
    }
    
    function renderLLMToolDetails(tool, idx, scope) {
      const toolType = tool.type || 'custom';
      let html = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:15px;"><h4 style="margin:0;">Edit Tool</h4><button id="delete-llm-tool" class="btn-danger" style="padding:5px 10px;font-size:12px;">Delete</button></div>';
      html += '<div class="detail-label">Tool Type</div>';
      html += '<select id="llm-tool-type" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
      ['custom', 'end_call', 'transfer_call', 'book_appointment_cal', 'check_calendar_availability', 'press_digit'].forEach(t => {
        html += '<option value="' + t + '"' + (toolType === t ? ' selected' : '') + '>' + t + '</option>';
      });
      html += '</select>';
      html += '<div class="detail-label">Name</div>';
      html += '<input type="text" id="llm-tool-name" value="' + escapeHtml(tool.name || '') + '" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
      html += '<div class="detail-label">Description</div>';
      html += '<textarea id="llm-tool-description" style="width:100%;height:60px;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;font-size:12px;resize:vertical;">' + escapeHtml(tool.description || '') + '</textarea>';
      
      if (toolType === 'custom') {
        html += '<div class="detail-label">Webhook URL</div>';
        html += '<input type="text" id="llm-tool-url" value="' + escapeHtml(tool.url || '') + '" placeholder="https://your-api.com/endpoint" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;font-family:monospace;font-size:12px;">';
        html += '<div class="detail-label">HTTP Method</div>';
        html += '<select id="llm-tool-method" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
        ['POST', 'GET', 'PUT', 'PATCH', 'DELETE'].forEach(m => { html += '<option value="' + m + '"' + ((tool.method || 'POST') === m ? ' selected' : '') + '>' + m + '</option>'; });
        html += '</select>';
        html += '<div class="detail-label">Timeout (ms)</div>';
        html += '<input type="number" id="llm-tool-timeout" value="' + (tool.timeout_ms || 10000) + '" min="1000" max="120000" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
        html += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;margin-bottom:15px;">';
        html += '<div><div class="detail-label">Speak During Execution</div><select id="llm-tool-speak" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">';
        html += '<option value="true"' + (tool.speak_during_execution !== false ? ' selected' : '') + '>Yes</option><option value="false"' + (tool.speak_during_execution === false ? ' selected' : '') + '>No</option></select></div>';
        html += '<div><div class="detail-label">Speak After Execution</div><select id="llm-tool-speak-after" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;">';
        html += '<option value="true"' + (tool.speak_after_execution !== false ? ' selected' : '') + '>Yes</option><option value="false"' + (tool.speak_after_execution === false ? ' selected' : '') + '>No</option></select></div>';
        html += '</div>';
        html += '<div class="detail-label">Message While Executing (optional)</div>';
        html += '<input type="text" id="llm-tool-exec-message" value="' + escapeHtml(tool.execution_message_description || '') + '" placeholder="e.g., Let me check that for you..." style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
        // Headers
        html += '<div class="detail-label">Headers</div><div id="llm-tool-headers" style="background:#f8f9fa;border:1px solid #ddd;border-radius:4px;padding:10px;margin-bottom:15px;">';
        const headers = tool.headers || {};
        if (Object.keys(headers).length === 0) { html += '<p style="color:#888;font-size:12px;margin:0 0 10px 0;">No headers configured</p>'; }
        else { Object.entries(headers).forEach(([key, value], hIdx) => {
          html += '<div class="llm-header-row" style="display:flex;gap:8px;margin-bottom:8px;">';
          html += '<input type="text" class="llm-header-key" data-idx="' + hIdx + '" value="' + escapeHtml(key) + '" placeholder="Header name" style="flex:1;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;">';
          html += '<input type="text" class="llm-header-value" data-idx="' + hIdx + '" value="' + escapeHtml(value) + '" placeholder="Value" style="flex:2;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;">';
          html += '<button type="button" class="llm-remove-header" data-key="' + escapeHtml(key) + '" style="padding:6px 10px;background:#dc3545;color:white;border:none;border-radius:4px;cursor:pointer;">✕</button></div>';
        }); }
        html += '<button type="button" id="llm-add-header" class="btn-secondary" style="width:100%;padding:6px;font-size:12px;">+ Add Header</button></div>';
        // Parameters
        html += '<div class="detail-label">Parameters</div><div id="llm-tool-params" style="background:#f8f9fa;border:1px solid #ddd;border-radius:4px;padding:10px;margin-bottom:15px;">';
        const params = tool.parameters?.properties || {};
        if (Object.keys(params).length === 0) { html += '<p style="color:#888;font-size:12px;margin:0 0 10px 0;">No parameters configured</p>'; }
        else { Object.entries(params).forEach(([key, param]) => {
          const isRequired = (tool.parameters?.required || []).includes(key);
          html += '<div class="llm-param-row" style="background:#fff;border:1px solid #e0e0e0;border-radius:4px;padding:10px;margin-bottom:8px;">';
          html += '<div style="display:flex;gap:8px;margin-bottom:8px;">';
          html += '<input type="text" class="llm-param-name" data-key="' + escapeHtml(key) + '" value="' + escapeHtml(key) + '" placeholder="Parameter name" style="flex:1;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;font-weight:600;">';
          html += '<select class="llm-param-type" data-key="' + escapeHtml(key) + '" style="width:100px;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:12px;">';
          ['string', 'number', 'boolean', 'integer', 'array', 'object'].forEach(t => { html += '<option value="' + t + '"' + ((param.type || 'string') === t ? ' selected' : '') + '>' + t + '</option>'; });
          html += '</select>';
          html += '<label style="display:flex;align-items:center;gap:4px;font-size:12px;"><input type="checkbox" class="llm-param-required" data-key="' + escapeHtml(key) + '"' + (isRequired ? ' checked' : '') + '> Required</label>';
          html += '<button type="button" class="llm-remove-param" data-key="' + escapeHtml(key) + '" style="padding:6px 10px;background:#dc3545;color:white;border:none;border-radius:4px;cursor:pointer;">✕</button></div>';
          html += '<input type="text" class="llm-param-desc" data-key="' + escapeHtml(key) + '" value="' + escapeHtml(param.description || '') + '" placeholder="Description" style="width:100%;padding:6px;border:1px solid #ddd;border-radius:4px;font-size:11px;"></div>';
        }); }
        html += '<button type="button" id="llm-add-param" class="btn-secondary" style="width:100%;padding:6px;font-size:12px;">+ Add Parameter</button></div>';
      } else if (toolType === 'transfer_call') {
        html += '<div class="detail-label">Transfer Number</div><input type="text" id="llm-tool-transfer-number" value="' + escapeHtml(tool.transfer_destination?.number || '') + '" placeholder="+15551234567" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
        html += '<div class="detail-label">Transfer Type</div><select id="llm-tool-transfer-type" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
        html += '<option value="cold_transfer"' + ((tool.transfer_option?.type || 'cold_transfer') === 'cold_transfer' ? ' selected' : '') + '>Cold Transfer</option>';
        html += '<option value="warm_transfer"' + (tool.transfer_option?.type === 'warm_transfer' ? ' selected' : '') + '>Warm Transfer</option></select>';
        html += '<div class="detail-label">Show Transferee as Caller</div><select id="llm-tool-show-transferee" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
        html += '<option value="false"' + (!tool.transfer_option?.show_transferee_as_caller ? ' selected' : '') + '>No</option>';
        html += '<option value="true"' + (tool.transfer_option?.show_transferee_as_caller ? ' selected' : '') + '>Yes</option></select>';
      } else if (toolType === 'end_call') {
        html += '<p style="font-size:12px;color:#666;background:#f8f9fa;padding:15px;border-radius:4px;">This tool ends the call when invoked.</p>';
      } else if (toolType === 'press_digit') {
        html += '<div class="detail-label">Digit to Press</div><input type="text" id="llm-tool-digit" value="' + escapeHtml(tool.digit || '') + '" placeholder="1" maxlength="4" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
      } else if (toolType === 'book_appointment_cal' || toolType === 'check_calendar_availability') {
        html += '<div class="detail-label">Cal.com API Key</div><input type="text" id="llm-tool-cal-key" value="' + escapeHtml(tool.cal_api_key || '') + '" placeholder="cal_live_xxx" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;font-family:monospace;">';
        html += '<div class="detail-label">Event Type ID</div><input type="number" id="llm-tool-event-id" value="' + (tool.event_type_id || '') + '" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
        html += '<div class="detail-label">Timezone</div><input type="text" id="llm-tool-timezone" value="' + escapeHtml(tool.timezone || 'America/New_York') + '" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
      }
      html += '<button id="save-llm-tool" class="btn-success" style="width:100%;margin-top:10px;">Save Tool Changes</button>';
      $('llm-tool-details').innerHTML = html;
      
      $('delete-llm-tool').addEventListener('click', () => deleteLLMTool(idx, scope));
      $('save-llm-tool').addEventListener('click', () => saveLLMTool(idx, scope));
      $('llm-tool-type').addEventListener('change', e => {
        const tools = scope === 'general' ? editedLLM.general_tools : editedLLM.states.find(s => s.name === selectedStateId).tools;
        tools[idx].type = e.target.value;
        setHasChanges(true);
        renderLLMToolDetails(tools[idx], idx, scope);
      });
      if (toolType === 'custom') {
        if ($('llm-add-header')) $('llm-add-header').addEventListener('click', () => { if (!tool.headers) tool.headers = {}; tool.headers['New-Header-' + Object.keys(tool.headers).length] = ''; setHasChanges(true); renderLLMToolDetails(tool, idx, scope); });
        document.querySelectorAll('.llm-remove-header').forEach(btn => { btn.addEventListener('click', () => { delete tool.headers[btn.dataset.key]; setHasChanges(true); renderLLMToolDetails(tool, idx, scope); }); });
        if ($('llm-add-param')) $('llm-add-param').addEventListener('click', () => {
          if (!tool.parameters) tool.parameters = { type: 'object', properties: {}, required: [] };
          if (!tool.parameters.properties) tool.parameters.properties = {};
          tool.parameters.properties['new_param_' + Object.keys(tool.parameters.properties).length] = { type: 'string', description: '' };
          setHasChanges(true); renderLLMToolDetails(tool, idx, scope);
        });
        document.querySelectorAll('.llm-remove-param').forEach(btn => { btn.addEventListener('click', () => { delete tool.parameters.properties[btn.dataset.key]; tool.parameters.required = (tool.parameters.required || []).filter(k => k !== btn.dataset.key); setHasChanges(true); renderLLMToolDetails(tool, idx, scope); }); });
      }
    }
    
    function saveLLMTool(idx, scope) {
      const tools = scope === 'general' ? editedLLM.general_tools : editedLLM.states.find(s => s.name === selectedStateId).tools;
      const tool = tools[idx];
      tool.name = $('llm-tool-name').value;
      tool.description = $('llm-tool-description').value;
      if (tool.type === 'custom') {
        tool.url = $('llm-tool-url').value;
        tool.method = $('llm-tool-method')?.value || 'POST';
        tool.timeout_ms = parseInt($('llm-tool-timeout')?.value) || 10000;
        tool.speak_during_execution = $('llm-tool-speak').value === 'true';
        tool.speak_after_execution = $('llm-tool-speak-after').value === 'true';
        tool.execution_message_description = $('llm-tool-exec-message')?.value || '';
        const newHeaders = {};
        document.querySelectorAll('.llm-header-row').forEach(row => { const k = row.querySelector('.llm-header-key'); const v = row.querySelector('.llm-header-value'); if (k && v && k.value.trim()) newHeaders[k.value.trim()] = v.value; });
        tool.headers = newHeaders;
        if (!tool.parameters) tool.parameters = { type: 'object', properties: {}, required: [] };
        const newProps = {}, newRequired = [];
        document.querySelectorAll('.llm-param-row').forEach(row => {
          const n = row.querySelector('.llm-param-name'), t = row.querySelector('.llm-param-type'), d = row.querySelector('.llm-param-desc'), r = row.querySelector('.llm-param-required');
          if (n && n.value.trim()) { newProps[n.value.trim()] = { type: t?.value || 'string', description: d?.value || '' }; if (r?.checked) newRequired.push(n.value.trim()); }
        });
        tool.parameters.properties = newProps;
        tool.parameters.required = newRequired;
      } else if (tool.type === 'transfer_call') {
        if (!tool.transfer_destination) tool.transfer_destination = { type: 'predefined' };
        tool.transfer_destination.number = $('llm-tool-transfer-number').value;
        if (!tool.transfer_option) tool.transfer_option = {};
        tool.transfer_option.type = $('llm-tool-transfer-type').value;
        tool.transfer_option.show_transferee_as_caller = $('llm-tool-show-transferee')?.value === 'true';
      } else if (tool.type === 'press_digit') { tool.digit = $('llm-tool-digit').value; }
      else if (tool.type === 'book_appointment_cal' || tool.type === 'check_calendar_availability') {
        tool.cal_api_key = $('llm-tool-cal-key').value;
        tool.event_type_id = parseInt($('llm-tool-event-id').value) || null;
        tool.timezone = $('llm-tool-timezone').value;
      }
      setHasChanges(true);
      renderLLMToolsPanel();
      showEditStatus('Tool updated', 'success');
    }
    
    function deleteLLMTool(idx, scope) {
      if (!confirm('Delete this tool?')) return;
      if (scope === 'general') editedLLM.general_tools.splice(idx, 1);
      else editedLLM.states.find(s => s.name === selectedStateId).tools.splice(idx, 1);
      setHasChanges(true);
      selectedLLMToolIdx = null;
      selectedLLMToolScope = null;
      renderLLMToolsPanel();
    }
    
    function addLLMTool(scope) {
      const newTool = { type: 'custom', name: 'New Tool', description: 'Description of what this tool does', url: '', speak_during_execution: true, speak_after_execution: true };
      if (scope === 'general') {
        if (!editedLLM.general_tools) editedLLM.general_tools = [];
        editedLLM.general_tools.push(newTool);
        setHasChanges(true);
        renderLLMToolsPanel();
        selectLLMTool(editedLLM.general_tools.length - 1, 'general');
      } else {
        const state = editedLLM.states.find(s => s.name === selectedStateId);
        if (!state.tools) state.tools = [];
        state.tools.push(newTool);
        setHasChanges(true);
        renderLLMToolsPanel();
        selectLLMTool(state.tools.length - 1, 'state');
      }
    }

    // ==================== LLM GLOBAL PANEL ====================
    function renderLLMGlobalPanel() {
      let html = '<h3 style="margin-top:0;">📝 Global Settings</h3>';
      html += '<p style="font-size:12px;color:#666;margin-bottom:15px;">These settings apply to all states.</p>';
      html += '<div class="detail-label">Model</div>';
      html += '<select id="llm-global-model" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
      const models = ['gpt-4o', 'gpt-4o-mini', 'gpt-4.1', 'gpt-4.1-mini', 'claude-3.5-sonnet', 'claude-3.5-haiku'];
      models.forEach(m => { html += '<option value="' + m + '"' + (editedLLM.model === m ? ' selected' : '') + '>' + m + '</option>'; });
      html += '</select>';
      html += '<div class="detail-label">Temperature</div>';
      html += '<input type="number" id="llm-global-temp" min="0" max="1" step="0.1" value="' + (editedLLM.general_temperature || 0) + '" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
      html += '<div class="detail-label">General Prompt (prepended to all states)</div>';
      html += '<textarea id="llm-global-prompt" style="width:100%;height:200px;font-family:monospace;font-size:12px;padding:10px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;resize:vertical;">' + escapeHtml(editedLLM.general_prompt || '') + '</textarea>';
      html += '<div class="detail-label">Begin Message</div>';
      html += '<textarea id="llm-global-begin" style="width:100%;height:60px;font-family:monospace;font-size:12px;padding:10px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;resize:vertical;">' + escapeHtml(editedLLM.begin_message || '') + '</textarea>';
      if (editorMode === 'multi-state') {
        html += '<div class="detail-label">Starting State</div>';
        html += '<select id="llm-starting-state" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
        (editedLLM.states || []).forEach(s => { html += '<option value="' + escapeHtml(s.name) + '"' + (editedLLM.starting_state === s.name ? ' selected' : '') + '>' + escapeHtml(s.name) + '</option>'; });
        html += '</select>';
      }
      html += '<div class="detail-label">Knowledge Bases</div>';
      html += '<div style="background:#f8f9fa;padding:10px;border-radius:4px;margin-bottom:15px;max-height:150px;overflow-y:auto;">';
      if (knowledgeBases.length === 0) { html += '<p style="color:#666;font-size:12px;margin:0;">No knowledge bases available</p>'; }
      else {
        const selectedKBs = editedLLM.knowledge_base_ids || [];
        knowledgeBases.forEach(kb => {
          const isChecked = selectedKBs.includes(kb.knowledge_base_id);
          html += '<label style="display:flex;align-items:center;gap:8px;margin-bottom:5px;cursor:pointer;"><input type="checkbox" class="llm-global-kb" data-kb-id="' + kb.knowledge_base_id + '"' + (isChecked ? ' checked' : '') + '><span style="font-size:12px;">' + escapeHtml(kb.knowledge_base_name) + '</span></label>';
        });
      }
      html += '</div>';
      // FIX 2: Save buttons start disabled
      html += '<div style="margin-top:20px;padding-top:15px;border-top:1px solid #eee;">';
      html += '<button id="llm-global-save" class="btn-success" style="margin-right:10px;" disabled>💾 Save Changes</button>';
      html += '<button id="llm-global-publish" class="btn-primary" disabled>🚀 Save & Publish</button>';
      html += '</div>';
      html += '<div id="llm-global-status" style="margin-top:10px;"></div>';
      $('panel-global').innerHTML = html;
      updateSaveButtonStates();
      
      $('llm-global-model').addEventListener('change', e => { editedLLM.model = e.target.value; setHasChanges(true); });
      $('llm-global-temp').addEventListener('input', e => { editedLLM.general_temperature = parseFloat(e.target.value); setHasChanges(true); });
      $('llm-global-prompt').addEventListener('input', e => { editedLLM.general_prompt = e.target.value; setHasChanges(true); });
      $('llm-global-begin').addEventListener('input', e => { editedLLM.begin_message = e.target.value; setHasChanges(true); });
      if ($('llm-starting-state')) $('llm-starting-state').addEventListener('change', e => { editedLLM.starting_state = e.target.value; setHasChanges(true); renderMultiStateFlow(); });
      document.querySelectorAll('.llm-global-kb').forEach(cb => {
        cb.addEventListener('change', () => {
          const selectedKBs = [];
          document.querySelectorAll('.llm-global-kb:checked').forEach(c => selectedKBs.push(c.dataset.kbId));
          editedLLM.knowledge_base_ids = selectedKBs;
          setHasChanges(true);
        });
      });
      $('llm-global-save').addEventListener('click', saveLLMChanges);
      $('llm-global-publish').addEventListener('click', saveLLMAndPublish);
    }
    
    // ==================== LLM SAVE FUNCTIONS ====================
    async function saveLLMChanges() {
      if (!hasChanges) { showEditStatus('No changes to save', 'info'); return; }
      const statusEl = editorMode === 'single-prompt' ? $('llm-save-status') : $('llm-global-status');
      statusEl.innerHTML = '<div class="edit-status info">Saving...</div>';
      try {
        const res = await fetch('/api/update-llm', {
          method: 'POST',
          headers: { 'Authorization': authToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ llm_id: currentAgent.llm_id, update_data: editedLLM })
        });
        const result = await res.json();
        if (result.success) {
          setHasChanges(false);
          statusEl.innerHTML = '<div class="edit-status success">Saved successfully!</div>';
          agentDetails.retell_llm = JSON.parse(JSON.stringify(editedLLM));
        } else {
          statusEl.innerHTML = '<div class="edit-status error">' + (result.error || 'Save failed') + '</div>';
        }
      } catch (err) { statusEl.innerHTML = '<div class="edit-status error">' + err.message + '</div>'; }
      setTimeout(() => { statusEl.innerHTML = ''; }, 4000);
    }
    
    async function saveLLMAndPublish() {
      await saveLLMChanges();
      if (!hasChanges) {
        const statusEl = editorMode === 'single-prompt' ? $('llm-save-status') : $('llm-global-status');
        statusEl.innerHTML = '<div class="edit-status info">Publishing...</div>';
        try {
          const res = await fetch('/api/publish', {
            method: 'POST',
            headers: { 'Authorization': authToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ agent_id: currentAgent.agent_id })
          });
          const result = await res.json();
          if (result.success) {
            // FIX 1 & 3: Update version number
            if (result.result?.version) currentAgent.version = result.result.version;
            $('flow-agent-name').textContent = currentAgent.agent_name + ' (v' + currentAgent.version + ')';
            updateVersionBadge();
            statusEl.innerHTML = '<div class="edit-status success">Published successfully! Version: v' + (result.result?.version || 'N/A') + '</div>';
          } else {
            statusEl.innerHTML = '<div class="edit-status error">' + (result.error || 'Publish failed') + '</div>';
          }
        } catch (err) { statusEl.innerHTML = '<div class="edit-status error">' + err.message + '</div>'; }
        setTimeout(() => { statusEl.innerHTML = ''; }, 4000);
      }
    }

    // Agent Settings Panel
    function renderAgentPanel() {
      let html = '<h3 style="margin-top:0;">🎙️ Agent Settings</h3>';
      html += '<p style="font-size:12px;color:#666;margin-bottom:15px;">These settings are saved directly to the agent (separate from conversation flow).</p>';
      html += '<div class="detail-label">Voice</div>';
      html += '<select id="edit-voice" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
      const currentVoice = agentDetails?.voice_id || '';
      voices.forEach(v => { html += '<option value="' + v.voice_id + '"' + (currentVoice === v.voice_id ? ' selected' : '') + '>' + escapeHtml(v.voice_name || v.voice_id) + (v.provider ? ' (' + v.provider + ')' : '') + '</option>'; });
      html += '</select>';
      html += '<div class="detail-label">Language</div>';
      html += '<select id="edit-language" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
      const languages = [{code:'en-US',name:'English (US)'},{code:'en-GB',name:'English (UK)'},{code:'es-ES',name:'Spanish (Spain)'},{code:'es-MX',name:'Spanish (Mexico)'},{code:'fr-FR',name:'French'},{code:'de-DE',name:'German'},{code:'it-IT',name:'Italian'},{code:'pt-BR',name:'Portuguese (Brazil)'},{code:'zh-CN',name:'Chinese (Mandarin)'},{code:'ja-JP',name:'Japanese'},{code:'ko-KR',name:'Korean'},{code:'multi',name:'Multilingual'}];
      const currentLang = agentDetails?.language || 'en-US';
      languages.forEach(l => { html += '<option value="' + l.code + '"' + (currentLang === l.code ? ' selected' : '') + '>' + l.name + '</option>'; });
      html += '</select>';
      html += '<div class="detail-label">Agent Name</div>';
      html += '<input type="text" id="edit-agent-name" value="' + escapeHtml(agentDetails?.agent_name || '') + '" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
      html += '<div class="detail-label">Interruption Sensitivity <span style="font-weight:normal;color:#888;">(0 = ignore, 1 = very sensitive)</span></div>';
      const intSens = agentDetails?.interruption_sensitivity !== undefined ? agentDetails.interruption_sensitivity : 1;
      html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:15px;"><input type="range" id="edit-int-sens-slider" min="0" max="1" step="0.1" value="' + intSens + '" style="flex:1;cursor:pointer;"><input type="number" id="edit-int-sens" min="0" max="1" step="0.1" value="' + intSens + '" style="width:60px;padding:5px;border:1px solid #ddd;border-radius:4px;text-align:center;"></div>';
      html += '<div class="detail-label">Voice Speed <span style="font-weight:normal;color:#888;">(0.5 = slow, 1 = normal, 2 = fast)</span></div>';
      const voiceSpeed = agentDetails?.voice_speed !== undefined ? agentDetails.voice_speed : 1;
      html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:15px;"><input type="range" id="edit-voice-speed-slider" min="0.5" max="2" step="0.1" value="' + voiceSpeed + '" style="flex:1;cursor:pointer;"><input type="number" id="edit-voice-speed" min="0.5" max="2" step="0.1" value="' + voiceSpeed + '" style="width:60px;padding:5px;border:1px solid #ddd;border-radius:4px;text-align:center;"></div>';
      html += '<div class="detail-label">Responsiveness <span style="font-weight:normal;color:#888;">(0 = slow/careful, 1 = fast)</span></div>';
      const responsiveness = agentDetails?.responsiveness !== undefined ? agentDetails.responsiveness : 1;
      html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:15px;"><input type="range" id="edit-responsiveness-slider" min="0" max="1" step="0.1" value="' + responsiveness + '" style="flex:1;cursor:pointer;"><input type="number" id="edit-responsiveness" min="0" max="1" step="0.1" value="' + responsiveness + '" style="width:60px;padding:5px;border:1px solid #ddd;border-radius:4px;text-align:center;"></div>';
      html += '<div class="detail-label">Enable Backchannel <span style="font-weight:normal;color:#888;">(uh-huh, mm-hmm)</span></div>';
      html += '<select id="edit-backchannel" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
      html += '<option value="false"' + (agentDetails?.enable_backchannel !== true ? ' selected' : '') + '>Disabled</option>';
      html += '<option value="true"' + (agentDetails?.enable_backchannel === true ? ' selected' : '') + '>Enabled</option></select>';
      html += '<div class="detail-label">Webhook URL</div>';
      html += '<input type="text" id="edit-webhook-url" value="' + escapeHtml(agentDetails?.webhook_url || '') + '" placeholder="https://your-server.com/webhook" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
      html += '<div class="detail-label">Post Call Analysis</div>';
      html += '<select id="edit-post-call" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
      html += '<option value="false"' + (!agentDetails?.post_call_analysis_data ? ' selected' : '') + '>Disabled</option>';
      html += '<option value="true"' + (agentDetails?.post_call_analysis_data ? ' selected' : '') + '>Enabled</option></select>';
      html += '<div class="detail-label">End Call After Silence <span style="font-weight:normal;color:#888;">(seconds, 0 = disabled)</span></div>';
      const endSilence = agentDetails?.end_call_after_silence_ms ? agentDetails.end_call_after_silence_ms / 1000 : 0;
      html += '<input type="number" id="edit-end-silence" value="' + endSilence + '" min="0" max="60" step="1" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
      html += '<div class="detail-label">Max Call Duration <span style="font-weight:normal;color:#888;">(seconds, 0 = unlimited)</span></div>';
      const maxDuration = agentDetails?.max_call_duration_ms ? agentDetails.max_call_duration_ms / 1000 : 0;
      html += '<input type="number" id="edit-max-duration" value="' + maxDuration + '" min="0" step="60" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:15px;">';
      html += '<div style="margin-top:15px;padding-top:15px;border-top:1px solid #ddd;"><button class="btn-success" id="agent-save" style="width:100%;margin-bottom:10px;">💾 Save Agent Settings</button><div id="agent-status"></div></div>';
      $('panel-agent').innerHTML = html;
      
      const sliderPairs = [['edit-int-sens-slider','edit-int-sens'],['edit-voice-speed-slider','edit-voice-speed'],['edit-responsiveness-slider','edit-responsiveness']];
      sliderPairs.forEach(([sliderId, inputId]) => {
        const slider = $(sliderId), input = $(inputId);
        if (slider && input) { slider.addEventListener('input', () => { input.value = slider.value; }); input.addEventListener('input', () => { slider.value = input.value; }); }
      });
      $('agent-save').addEventListener('click', async () => {
        const statusEl = $('agent-status');
        statusEl.innerHTML = '<div class="edit-status info">⏳ Saving agent settings...</div>';
        try {
          const settings = {
            agent_name: $('edit-agent-name').value,
            voice_id: $('edit-voice').value,
            language: $('edit-language').value,
            interruption_sensitivity: parseFloat($('edit-int-sens').value),
            voice_speed: parseFloat($('edit-voice-speed').value),
            responsiveness: parseFloat($('edit-responsiveness').value),
            enable_backchannel: $('edit-backchannel').value === 'true',
            webhook_url: $('edit-webhook-url').value || undefined,
            end_call_after_silence_ms: parseInt($('edit-end-silence').value) * 1000 || undefined,
            max_call_duration_ms: parseInt($('edit-max-duration').value) * 1000 || undefined
          };
          Object.keys(settings).forEach(k => settings[k] === undefined && delete settings[k]);
          const res = await fetch('/api/update-agent', {
            method: 'POST',
            headers: { 'Authorization': authToken, 'Content-Type': 'application/json' },
            body: JSON.stringify({ agent_id: currentAgent.agent_id, settings })
          });
          const result = await res.json();
          if (result.success) {
            statusEl.innerHTML = '<div class="edit-status success">✅ Agent settings saved!</div>';
            Object.assign(agentDetails, settings);
            setTimeout(() => { statusEl.innerHTML = ''; }, 3000);
          } else { statusEl.innerHTML = '<div class="edit-status error">❌ ' + result.error + '</div>'; }
        } catch (err) { statusEl.innerHTML = '<div class="edit-status error">❌ ' + err.message + '</div>'; }
      });
    }

    // ==================== ACTIONS PANEL ====================
    function renderActionsPanel() {
      let html = '<h3 style="margin-top:0;">⚡ Actions</h3>';
      html += '<div style="background:#e3f2fd;border:2px solid #2196f3;border-radius:8px;padding:15px;margin-bottom:20px;">';
      html += '<div class="detail-label" style="color:#1565c0;margin-top:0;">📋 Duplicate Entire Flow</div>';
      html += '<p style="font-size:12px;color:#666;margin:10px 0;">Create a complete copy of this flow.</p>';
      html += '<div class="detail-label">Destination</div>';
      html += '<select id="duplicate-destination" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:10px;">';
      html += '<option value="download">Download as JSON file</option>';
      html += '<option value="current">Save to current agent (backup)</option>';
      const flowAgents = allAgentsList.filter(a => a.conversation_flow_id && a.agent_id !== currentAgent?.agent_id);
      flowAgents.forEach(a => { html += '<option value="' + a.agent_id + '|' + a.conversation_flow_id + '">Copy to: ' + escapeHtml(a.agent_name) + '</option>'; });
      html += '</select>';
      html += '<button id="duplicate-flow-btn" class="btn-primary" style="width:100%;">📋 Duplicate Flow</button>';
      html += '<div id="duplicate-status" style="margin-top:10px;"></div></div>';
      
      html += '<div style="background:#fff3e0;border:2px solid #ff9800;border-radius:8px;padding:15px;margin-bottom:20px;">';
      html += '<div class="detail-label" style="color:#e65100;margin-top:0;">📦 Copy Nodes to Another Agent</div>';
      html += '<p style="font-size:12px;color:#666;margin:10px 0;">Select nodes from the flow, then paste them into another agent.</p>';
      html += '<div style="display:flex;align-items:center;gap:10px;margin-bottom:15px;">';
      html += '<button id="toggle-copy-mode" class="' + (copyMode ? 'btn-warning' : 'btn-secondary') + '" style="flex:1;">' + (copyMode ? 'Selection Mode ON - Click Nodes' : 'Enable Selection Mode') + '</button>';
      html += '<button id="clear-selection" class="btn-secondary" style="padding:8px 12px;" title="Clear selection">Clear</button></div>';
      html += '<div id="selected-nodes-info" style="background:#fff;padding:10px;border-radius:4px;margin-bottom:10px;border:1px solid #ddd;">';
      if (selectedNodesForCopy.size === 0) { html += '<p style="color:#666;font-size:12px;margin:0;">No nodes selected.</p>'; }
      else {
        html += '<p style="color:#e65100;font-weight:600;margin:0 0 5px 0;">' + selectedNodesForCopy.size + ' node(s) selected:</p>';
        html += '<ul style="margin:0;padding-left:20px;font-size:12px;max-height:100px;overflow-y:auto;">';
        selectedNodesForCopy.forEach(nodeId => { const node = editedFlow.nodes.find(n => n.id === nodeId); html += '<li>' + escapeHtml(node?.name || nodeId) + '</li>'; });
        html += '</ul>';
      }
      html += '</div>';
      html += '<div class="detail-label">Paste to Agent</div>';
      html += '<select id="copy-destination" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:10px;">';
      html += '<option value="">-- Select destination agent --</option>';
      flowAgents.forEach(a => { html += '<option value="' + a.agent_id + '|' + a.conversation_flow_id + '">' + escapeHtml(a.agent_name) + '</option>'; });
      html += '</select>';
      html += '<button id="copy-nodes-btn" class="btn-warning" style="width:100%;" ' + (selectedNodesForCopy.size === 0 ? 'disabled' : '') + '>📦 Copy Selected Nodes</button>';
      html += '<div id="copy-status" style="margin-top:10px;"></div></div>';
      
      html += '<div style="background:#f3e5f5;border:2px solid #9c27b0;border-radius:8px;padding:15px;">';
      html += '<div class="detail-label" style="color:#7b1fa2;margin-top:0;">📤 Export / Import Nodes</div>';
      html += '<button id="export-nodes-btn" class="btn-secondary" style="width:100%;margin-bottom:10px;" ' + (selectedNodesForCopy.size === 0 ? 'disabled' : '') + '>📤 Export Selected Nodes as JSON</button>';
      html += '<div class="detail-label">Import Nodes from JSON</div>';
      html += '<textarea id="import-nodes-json" placeholder="Paste exported nodes JSON here..." style="width:100%;height:80px;font-family:monospace;font-size:11px;padding:8px;border:1px solid #ddd;border-radius:4px;margin-bottom:10px;resize:vertical;"></textarea>';
      html += '<button id="import-nodes-btn" class="btn-secondary" style="width:100%;">📥 Import Nodes to Current Flow</button>';
      html += '<div id="import-status" style="margin-top:10px;"></div></div>';
      $('panel-actions').innerHTML = html;
      
      $('duplicate-flow-btn').addEventListener('click', duplicateFlow);
      $('toggle-copy-mode').addEventListener('click', toggleCopyMode);
      $('clear-selection').addEventListener('click', clearNodeSelection);
      $('copy-nodes-btn').addEventListener('click', copyNodesToAgent);
      $('export-nodes-btn').addEventListener('click', exportSelectedNodes);
      $('import-nodes-btn').addEventListener('click', importNodes);
    }
    
    function toggleCopyMode() { copyMode = !copyMode; renderActionsPanel(); renderFlow(); if (copyMode) showEditStatus('Click nodes to select them for copying', 'info'); }
    function clearNodeSelection() { selectedNodesForCopy.clear(); renderActionsPanel(); renderFlow(); }
    function toggleNodeSelection(nodeId) {
      if (selectedNodesForCopy.has(nodeId)) selectedNodesForCopy.delete(nodeId);
      else selectedNodesForCopy.add(nodeId);
      renderActionsPanel(); renderFlow();
    }
    
    async function duplicateFlow() {
      const dest = $('duplicate-destination').value;
      const statusEl = $('duplicate-status');
      if (dest === 'download') {
        const blob = new Blob([JSON.stringify(JSON.parse(JSON.stringify(editedFlow)), null, 2)], { type: 'application/json' });
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = (currentAgent?.agent_name || 'flow') + '_backup_' + new Date().toISOString().slice(0,10) + '.json';
        a.click();
        statusEl.innerHTML = '<div class="edit-status success">Downloaded!</div>';
        setTimeout(() => { statusEl.innerHTML = ''; }, 3000);
        return;
      }
      if (dest === 'current') { statusEl.innerHTML = '<div class="edit-status info">Flow is already loaded. Use Save to save changes.</div>'; setTimeout(() => { statusEl.innerHTML = ''; }, 3000); return; }
      const [agentId, flowId] = dest.split('|');
      statusEl.innerHTML = '<div class="edit-status info">Copying flow...</div>';
      try {
        const res = await fetch('/api/update', {
          method: 'POST',
          headers: { 'Authorization': authToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent_id: agentId, conversation_flow_id: flowId, update_data: JSON.parse(JSON.stringify(editedFlow)) })
        });
        const result = await res.json();
        statusEl.innerHTML = result.success ? '<div class="edit-status success">Flow copied successfully!</div>' : '<div class="edit-status error">' + (result.error || 'Copy failed') + '</div>';
      } catch (err) { statusEl.innerHTML = '<div class="edit-status error">' + err.message + '</div>'; }
      setTimeout(() => { statusEl.innerHTML = ''; }, 4000);
    }
    
    async function copyNodesToAgent() {
      const dest = $('copy-destination').value;
      const statusEl = $('copy-status');
      if (!dest) { statusEl.innerHTML = '<div class="edit-status error">Select a destination agent</div>'; setTimeout(() => { statusEl.innerHTML = ''; }, 3000); return; }
      if (selectedNodesForCopy.size === 0) { statusEl.innerHTML = '<div class="edit-status error">No nodes selected</div>'; setTimeout(() => { statusEl.innerHTML = ''; }, 3000); return; }
      const [agentId, flowId] = dest.split('|');
      statusEl.innerHTML = '<div class="edit-status info">Copying nodes...</div>';
      try {
        const destAgent = allAgentsList.find(a => a.agent_id === agentId);
        const agentRes = await fetch('/api/agent?id=' + agentId, { headers: { 'Authorization': authToken } });
        const agentData = await agentRes.json();
        const destFlow = agentData.conversation_flow;
        if (!destFlow) { statusEl.innerHTML = '<div class="edit-status error">Could not load destination flow</div>'; return; }
        const idMap = {};
        const timestamp = Date.now();
        const copiedNodes = [];
        selectedNodesForCopy.forEach(nodeId => {
          const node = editedFlow.nodes.find(n => n.id === nodeId);
          if (node) {
            const newNode = JSON.parse(JSON.stringify(node));
            const newId = 'copied-' + timestamp + '-' + Math.random().toString(36).substr(2, 9);
            idMap[node.id] = newId;
            newNode.id = newId;
            newNode.name = (newNode.name || 'Node') + ' (copied)';
            if (newNode.display_position) { newNode.display_position.x += 200; newNode.display_position.y += 100; }
            copiedNodes.push(newNode);
          }
        });
        copiedNodes.forEach(node => {
          if (node.edges) { node.edges = node.edges.map(e => { const ne = { ...e }; ne.id = 'edge-' + timestamp + '-' + Math.random().toString(36).substr(2, 9); if (idMap[e.destination_node_id]) { ne.destination_node_id = idMap[e.destination_node_id]; return ne; } return null; }).filter(Boolean); }
          if (node.skip_response_edge) { if (idMap[node.skip_response_edge.destination_node_id]) { node.skip_response_edge.destination_node_id = idMap[node.skip_response_edge.destination_node_id]; node.skip_response_edge.id = 'skip-' + timestamp + '-' + Math.random().toString(36).substr(2, 9); } else delete node.skip_response_edge; }
        });
        destFlow.nodes = [...destFlow.nodes, ...copiedNodes];
        const toolIds = new Set();
        copiedNodes.forEach(n => { if (n.tool_id) toolIds.add(n.tool_id); });
        toolIds.forEach(toolId => { const tool = editedFlow.tools?.find(t => t.tool_id === toolId); if (tool && !destFlow.tools?.find(t => t.tool_id === toolId)) { if (!destFlow.tools) destFlow.tools = []; destFlow.tools.push(JSON.parse(JSON.stringify(tool))); } });
        const res = await fetch('/api/update', {
          method: 'POST',
          headers: { 'Authorization': authToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent_id: agentId, conversation_flow_id: flowId, update_data: destFlow })
        });
        const result = await res.json();
        if (result.success) { statusEl.innerHTML = '<div class="edit-status success">' + copiedNodes.length + ' node(s) copied to ' + escapeHtml(destAgent?.agent_name || 'agent') + '!</div>'; clearNodeSelection(); }
        else statusEl.innerHTML = '<div class="edit-status error">' + (result.error || 'Copy failed') + '</div>';
      } catch (err) { statusEl.innerHTML = '<div class="edit-status error">' + err.message + '</div>'; }
      setTimeout(() => { statusEl.innerHTML = ''; }, 4000);
    }
    
    function exportSelectedNodes() {
      if (selectedNodesForCopy.size === 0) return;
      const exportData = { nodes: [], tools: [], exported_from: currentAgent?.agent_name, exported_at: new Date().toISOString() };
      const toolIds = new Set();
      selectedNodesForCopy.forEach(nodeId => { const node = editedFlow.nodes.find(n => n.id === nodeId); if (node) { exportData.nodes.push(JSON.parse(JSON.stringify(node))); if (node.tool_id) toolIds.add(node.tool_id); } });
      toolIds.forEach(toolId => { const tool = editedFlow.tools?.find(t => t.tool_id === toolId); if (tool) exportData.tools.push(JSON.parse(JSON.stringify(tool))); });
      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'nodes_export_' + new Date().toISOString().slice(0,10) + '.json';
      a.click();
    }
    
    function importNodes() {
      const jsonText = $('import-nodes-json').value.trim();
      const statusEl = $('import-status');
      if (!jsonText) { statusEl.innerHTML = '<div class="edit-status error">Paste JSON to import</div>'; setTimeout(() => { statusEl.innerHTML = ''; }, 3000); return; }
      try {
        const importData = JSON.parse(jsonText);
        if (!importData.nodes || !Array.isArray(importData.nodes) || importData.nodes.length === 0) { statusEl.innerHTML = '<div class="edit-status error">Invalid format: no nodes found</div>'; setTimeout(() => { statusEl.innerHTML = ''; }, 3000); return; }
        const idMap = {};
        const timestamp = Date.now();
        importData.nodes.forEach(node => {
          const newId = 'imported-' + timestamp + '-' + Math.random().toString(36).substr(2, 9);
          idMap[node.id] = newId;
          node.id = newId;
          node.name = (node.name || 'Node') + ' (imported)';
          if (node.display_position) { node.display_position.x += 300; node.display_position.y += 150; }
        });
        importData.nodes.forEach(node => {
          if (node.edges) { node.edges = node.edges.map(e => { e.id = 'edge-' + timestamp + '-' + Math.random().toString(36).substr(2, 9); if (idMap[e.destination_node_id]) { e.destination_node_id = idMap[e.destination_node_id]; return e; } return null; }).filter(Boolean); }
          if (node.skip_response_edge && idMap[node.skip_response_edge.destination_node_id]) { node.skip_response_edge.destination_node_id = idMap[node.skip_response_edge.destination_node_id]; node.skip_response_edge.id = 'skip-' + timestamp + '-' + Math.random().toString(36).substr(2, 9); } else if (node.skip_response_edge) delete node.skip_response_edge;
        });
        editedFlow.nodes = [...editedFlow.nodes, ...importData.nodes];
        if (importData.tools && importData.tools.length > 0) {
          if (!editedFlow.tools) editedFlow.tools = [];
          importData.tools.forEach(tool => { if (!editedFlow.tools.find(t => t.tool_id === tool.tool_id)) editedFlow.tools.push(tool); });
        }
        setHasChanges(true);
        renderFlow();
        $('import-nodes-json').value = '';
        statusEl.innerHTML = '<div class="edit-status success">Imported ' + importData.nodes.length + ' node(s)! Remember to save.</div>';
      } catch (err) { statusEl.innerHTML = '<div class="edit-status error">Invalid JSON: ' + err.message + '</div>'; }
      setTimeout(() => { statusEl.innerHTML = ''; }, 4000);
    }

    // ==================== SAVE (Conversation Flow) ====================
    async function saveChanges() {
      if (!hasChanges) { showEditStatus('No changes to save', 'info'); return; }
      $('save-btn').disabled = true;
      $('save-publish-btn').disabled = true;
      showEditStatus('⏳ Saving to draft...', 'info');
      try {
        const res = await fetch('/api/update', {
          method: 'POST',
          headers: { 'Authorization': authToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent_id: currentAgent.agent_id, conversation_flow_id: currentAgent.conversation_flow_id, update_data: editedFlow, version_description: 'Updated via Flow Viewer' })
        });
        const result = await res.json();
        if (result.success) {
          showEditStatus('✅ Saved to draft successfully!', 'success');
          setHasChanges(false);
          currentFlow = JSON.parse(JSON.stringify(editedFlow));
          $('current-config').value = JSON.stringify(currentFlow, null, 2);
        } else { showEditStatus('❌ Save failed: ' + result.error, 'error'); }
      } catch (err) { showEditStatus('❌ Connection error: ' + err.message, 'error'); }
      finally { updateSaveButtonStates(); }
    }

    async function saveAndPublish() {
      // FIX 2: Guard against publishing with no changes
      if (!hasChanges) { showEditStatus('No changes to publish', 'info'); return; }
      $('save-btn').disabled = true;
      $('save-publish-btn').disabled = true;
      showEditStatus('⏳ Saving to draft...', 'info');
      try {
        let res = await fetch('/api/update', {
          method: 'POST',
          headers: { 'Authorization': authToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent_id: currentAgent.agent_id, conversation_flow_id: currentAgent.conversation_flow_id, update_data: editedFlow, version_description: 'Updated via Flow Viewer' })
        });
        let result = await res.json();
        if (!result.success) { showEditStatus('❌ Save failed: ' + result.error, 'error'); return; }
        showEditStatus('⏳ Publishing...', 'info');
        res = await fetch('/api/publish', {
          method: 'POST',
          headers: { 'Authorization': authToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent_id: currentAgent.agent_id })
        });
        result = await res.json();
        if (result.success) {
          showEditStatus('✅ Published successfully! New version: v' + (result.result?.version || 'N/A'), 'success');
          setHasChanges(false);
          currentFlow = JSON.parse(JSON.stringify(editedFlow));
          // FIX 1 & 3: Update version number everywhere
          if (result.result?.version) currentAgent.version = result.result.version;
          $('flow-agent-name').textContent = currentAgent.agent_name + ' (v' + currentAgent.version + ')';
          updateVersionBadge();
          $('current-config').value = JSON.stringify(currentFlow, null, 2);
        } else { showEditStatus('❌ Publish failed: ' + result.error, 'error'); }
      } catch (err) { showEditStatus('❌ Connection error: ' + err.message, 'error'); }
      finally { updateSaveButtonStates(); }
    }

    function showEditStatus(msg, type) {
      const container = $('edit-status-container');
      container.innerHTML = '<div class="edit-status ' + type + '">' + msg + '</div>';
      if (type === 'success') setTimeout(() => { container.innerHTML = ''; }, 4000);
    }

    // ==================== MAIN TAB SWITCHING ====================
    function switchMainTab(tab) {
      document.querySelectorAll('.main-tab').forEach(t => t.classList.toggle('active', t.dataset.tab === tab));
      $('tab-prompts').classList.toggle('hidden', tab !== 'prompts');
      $('tab-pronunciation').classList.toggle('hidden', tab !== 'pronunciation');
      if (tab === 'pronunciation') populatePronAgentSelect();
    }

    // ==================== PRONUNCIATION MANAGER ====================
    function populatePronAgentSelect() {
      const filtered = showAllAgents ? allAgentsList : allAgentsList.filter(a => a.is_published);
      filtered.sort((a, b) => a.agent_name.localeCompare(b.agent_name));
      const options = filtered.map(a => '<option value="' + a.agent_id + '">' + escapeHtml(a.agent_name) + ' (v' + a.version + ')</option>').join('');
      $('pron-agent-select').innerHTML = '<option value="">-- Select an agent --</option>' + options;
    }

    async function loadPronunciation() {
      const agentId = $('pron-agent-select').value;
      if (!agentId) {
        $('pron-stats').classList.add('hidden');
        $('pron-editor').classList.add('hidden');
        $('pron-voice-status').innerHTML = '';
        return;
      }
      try {
        showStatus('pron-status', 'Loading...', 'info');
        const res = await fetch('/api/pronunciation?agent_id=' + encodeURIComponent(agentId), { headers: { 'Authorization': authToken } });
        const data = await res.json();
        if (data.error) { showStatus('pron-status', '❌ ' + data.error, 'error'); return; }
        pronunciationList = data.pronunciation_dictionary || [];
        const voice = data.voice_id || '';
        const is11Labs = voice.toLowerCase().includes('11labs') || voice.toLowerCase().includes('eleven');
        $('pron-voice-status').innerHTML = is11Labs
          ? '<div class="voice-ok">✅ <strong>11Labs voice:</strong> ' + escapeHtml(voice) + ' — Pronunciation supported!</div>'
          : '<div class="voice-warning">⚠️ <strong>Voice:</strong> ' + escapeHtml(voice || 'Not set') + ' — Pronunciation only works with 11Labs voices.</div>';
        $('pron-count').textContent = pronunciationList.length;
        $('pron-voice').textContent = voice ? voice.split('-')[0] : '--';
        $('pron-stats').classList.remove('hidden');
        $('pron-editor').classList.remove('hidden');
        renderPronunciationList();
        $('pron-status').className = 'status'; $('pron-status').textContent = '';
      } catch (err) {
        showStatus('pron-status', '❌ ' + err.message, 'error');
      }
    }

    function renderPronunciationList() {
      const container = $('pron-list');
      if (pronunciationList.length === 0) {
        container.innerHTML = '<p style="color:#666;text-align:center;padding:40px;">No pronunciations. Click "Add Entry" or "Load Medical Template".</p>';
        return;
      }
      let html = '<table class="pron-table"><thead><tr><th>Word</th><th>Alphabet</th><th>Phonetic</th><th>Actions</th></tr></thead><tbody>';
      pronunciationList.forEach((entry, idx) => {
        html += '<tr>';
        html += '<td><input type="text" class="pron-word" data-idx="' + idx + '" value="' + escapeHtml(entry.word || '') + '" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></td>';
        html += '<td><select class="pron-alphabet" data-idx="' + idx + '" style="padding:8px;border:1px solid #ddd;border-radius:4px;">';
        html += '<option value="ipa"' + ((entry.alphabet || 'ipa') === 'ipa' ? ' selected' : '') + '>IPA</option>';
        html += '<option value="cmu"' + (entry.alphabet === 'cmu' ? ' selected' : '') + '>CMU</option>';
        html += '</select></td>';
        html += '<td><input type="text" class="pron-phoneme" data-idx="' + idx + '" value="' + escapeHtml(entry.phoneme || '') + '" style="width:100%;padding:8px;border:1px solid #ddd;border-radius:4px;"></td>';
        html += '<td><button class="btn-danger remove-pron-btn" data-idx="' + idx + '" style="padding:6px 12px;">🗑️</button></td>';
        html += '</tr>';
      });
      html += '</tbody></table>';
      container.innerHTML = html;

      container.querySelectorAll('.pron-word').forEach(input => {
        input.addEventListener('input', () => { pronunciationList[parseInt(input.dataset.idx, 10)].word = input.value; });
      });
      container.querySelectorAll('.pron-alphabet').forEach(select => {
        select.addEventListener('change', () => { pronunciationList[parseInt(select.dataset.idx, 10)].alphabet = select.value; });
      });
      container.querySelectorAll('.pron-phoneme').forEach(input => {
        input.addEventListener('input', () => { pronunciationList[parseInt(input.dataset.idx, 10)].phoneme = input.value; });
      });
      container.querySelectorAll('.remove-pron-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          pronunciationList.splice(parseInt(btn.dataset.idx, 10), 1);
          renderPronunciationList();
          $('pron-count').textContent = pronunciationList.length;
        });
      });
    }

    function addPronunciationEntry() {
      pronunciationList.unshift({ word: '', alphabet: 'ipa', phoneme: '' });
      renderPronunciationList();
      $('pron-count').textContent = pronunciationList.length;
      const firstInput = $('pron-list').querySelector('.pron-word');
      if (firstInput) firstInput.focus();
    }

    async function savePronunciation() {
      const agentId = $('pron-agent-select').value;
      if (!agentId) return;
      const validEntries = pronunciationList.filter(e => e.word && e.phoneme);
      try {
        showStatus('pron-status', 'Saving ' + validEntries.length + ' pronunciations...', 'info');
        const res = await fetch('/api/pronunciation', {
          method: 'POST',
          headers: { 'Authorization': authToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ agent_id: agentId, pronunciation_dictionary: validEntries })
        });
        const result = await res.json();
        if (result.success) {
          showStatus('pron-status', '✅ Saved ' + result.count + ' pronunciations!', 'success');
        } else {
          showStatus('pron-status', '❌ ' + (result.error || 'Unknown error'), 'error');
        }
      } catch (err) {
        showStatus('pron-status', '❌ ' + err.message, 'error');
      }
    }

    function loadMedicalTemplate() {
      const template = [
        { word: 'HIPAA', alphabet: 'ipa', phoneme: 'ˈhɪpə' },
        { word: 'COPD', alphabet: 'ipa', phoneme: 'siː oʊ piː diː' },
        { word: 'EKG', alphabet: 'ipa', phoneme: 'iː keɪ dʒiː' },
        { word: 'OB-GYN', alphabet: 'ipa', phoneme: 'oʊ biː dʒiː waɪ ɛn' },
        { word: 'A1C', alphabet: 'ipa', phoneme: 'eɪ wʌn siː' },
        { word: 'MRI', alphabet: 'ipa', phoneme: 'ɛm ɑːr aɪ' },
        { word: 'CT', alphabet: 'ipa', phoneme: 'siː tiː' },
        { word: 'UTI', alphabet: 'ipa', phoneme: 'juː tiː aɪ' },
        { word: 'ENT', alphabet: 'ipa', phoneme: 'iː ɛn tiː' },
        { word: 'ER', alphabet: 'ipa', phoneme: 'iː ɑːr' },
        { word: 'ICU', alphabet: 'ipa', phoneme: 'aɪ siː juː' },
        { word: 'IV', alphabet: 'ipa', phoneme: 'aɪ viː' },
        { word: 'BP', alphabet: 'ipa', phoneme: 'biː piː' },
        { word: 'CBC', alphabet: 'ipa', phoneme: 'siː biː siː' },
        { word: 'BMI', alphabet: 'ipa', phoneme: 'biː ɛm aɪ' },
        { word: 'PPO', alphabet: 'ipa', phoneme: 'piː piː oʊ' },
        { word: 'HMO', alphabet: 'ipa', phoneme: 'eɪtʃ ɛm oʊ' },
        { word: 'HSA', alphabet: 'ipa', phoneme: 'eɪtʃ ɛs eɪ' },
        { word: 'FSA', alphabet: 'ipa', phoneme: 'ɛf ɛs eɪ' },
        { word: 'PCP', alphabet: 'ipa', phoneme: 'piː siː piː' },
        { word: 'NP', alphabet: 'ipa', phoneme: 'ɛn piː' },
        { word: 'PA', alphabet: 'ipa', phoneme: 'piː eɪ' },
        { word: 'RN', alphabet: 'ipa', phoneme: 'ɑːr ɛn' },
        { word: 'MD', alphabet: 'ipa', phoneme: 'ɛm diː' },
        { word: 'Aetna', alphabet: 'ipa', phoneme: 'ˈɛtnə' },
        { word: 'Cigna', alphabet: 'ipa', phoneme: 'ˈsɪɡnə' },
        { word: 'Humana', alphabet: 'ipa', phoneme: 'hjuːˈmænə' },
        { word: 'copay', alphabet: 'ipa', phoneme: 'ˈkoʊpeɪ' },
        { word: 'Medi-Cal', alphabet: 'ipa', phoneme: 'ˈmɛdɪkæl' },
        { word: 'Tricare', alphabet: 'ipa', phoneme: 'ˈtraɪkɛr' },
        { word: 'GERD', alphabet: 'ipa', phoneme: 'ɡɜːrd' },
        { word: 'AFib', alphabet: 'ipa', phoneme: 'eɪ fɪb' },
        { word: 'DEXA', alphabet: 'ipa', phoneme: 'ˈdɛksə' },
        { word: 'COBRA', alphabet: 'ipa', phoneme: 'ˈkoʊbrə' },
      ];
      const existingWords = new Set(pronunciationList.map(e => (e.word || '').toLowerCase()));
      const newEntries = template.filter(t => !existingWords.has(t.word.toLowerCase()));
      pronunciationList = [...pronunciationList, ...newEntries];
      renderPronunciationList();
      $('pron-count').textContent = pronunciationList.length;
      showStatus('pron-status', '✅ Loaded ' + newEntries.length + ' medical terms (' + (template.length - newEntries.length) + ' duplicates skipped)', 'success');
    }

    function clearAllPronunciations() {
      if (!confirm('Clear all pronunciation entries? This does NOT save — you must click Save to commit.')) return;
      pronunciationList = [];
      renderPronunciationList();
      $('pron-count').textContent = 0;
    }

    function exportPronunciation() {
      const blob = new Blob([JSON.stringify(pronunciationList, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'pronunciation_' + ($('pron-agent-select').value || 'export') + '.json';
      a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }

    function bulkImportPronunciation() {
      const raw = $('bulk-import-input').value.trim();
      if (!raw) { showStatus('pron-status', '❌ Paste JSON or CSV first', 'error'); return; }
      try {
        let imported = [];
        if (raw.startsWith('[')) {
          imported = JSON.parse(raw);
        } else {
          raw.split('\\n').forEach(line => {
            const parts = line.split(',').map(s => s.trim());
            if (parts.length >= 2 && parts[0] && parts[1]) {
              imported.push({ word: parts[0], alphabet: 'ipa', phoneme: parts[1] });
            }
          });
        }
        if (!imported.length) { showStatus('pron-status', '❌ No valid entries found', 'error'); return; }
        const existingWords = new Set(pronunciationList.map(e => (e.word || '').toLowerCase()));
        const newEntries = imported.filter(e => e.word && e.phoneme && !existingWords.has(e.word.toLowerCase()));
        pronunciationList = [...pronunciationList, ...newEntries];
        renderPronunciationList();
        $('pron-count').textContent = pronunciationList.length;
        $('bulk-import-input').value = '';
        showStatus('pron-status', '✅ Imported ' + newEntries.length + ' entries (' + (imported.length - newEntries.length) + ' duplicates skipped)', 'success');
      } catch (err) {
        showStatus('pron-status', '❌ Invalid format: ' + err.message, 'error');
      }
    }


    function escapeHtml(text) {
      if (!text) return '';
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
    }
  </script>
</body>
</html>`;
}