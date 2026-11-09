'use client';

import React, { useState, useEffect, useTransition } from 'react';
import Link from 'next/link';
import {
  NotificationTemplate,
  NotificationSettings,
  NotificationLogItem,
  NotificationAnalytics,
  NotificationTemplateCode,
  NotificationLanguage,
} from '@/types/notification';
import { NotificationService, DEFAULT_TEMPLATES } from '@/lib/services/notification-service';

// Web Audio API Synthesized Chime for Test Dispatch
const playNotificationChime = () => {
  if (typeof window !== 'undefined' && 'AudioContext' in window) {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(659.25, ctx.currentTime); // E5
      osc.frequency.setValueAtTime(880, ctx.currentTime + 0.08); // A5
      gain.gain.setValueAtTime(0.2, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.4);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.4);
    } catch {}
  }
};

const TEMPLATE_ICONS: Record<NotificationTemplateCode, string> = {
  appointment_created: 'calendar_add_on',
  appointment_confirmed: 'event_available',
  appointment_reminder: 'alarm',
  queue_joined: 'confirmation_number',
  queue_position_update: 'hourglass_top',
  now_serving: 'notifications_active',
  service_completed: 'task_alt',
  payment_confirmed: 'receipt_long',
  invoice_delivery: 'description',
  appointment_cancelled: 'event_busy',
  marketing_campaign: 'campaign',
};

export default function NotificationCenterCockpit() {
  const [isPending, startTransition] = useTransition();

  // Navigation tab: 'dashboard' | 'templates' | 'outbox' | 'settings'
  const [activeTab, setActiveTab] = useState<'dashboard' | 'templates' | 'outbox' | 'settings'>('templates');

  // Analytics & Logs
  const [analytics, setAnalytics] = useState<NotificationAnalytics | null>(null);
  const [logs, setLogs] = useState<NotificationLogItem[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Settings State
  const [settings, setSettings] = useState<NotificationSettings>({
    branchId: 'b0000000-0000-0000-0000-000000000001',
    enableAppointmentMessages: true,
    enableQueueMessages: true,
    enableInvoiceMessages: true,
    enableMarketingMessages: false,
    enableReminderMessages: true,
    reminderLeadMinutes: 60,
    smsFallbackEnabled: true,
    whatsappProvider: 'click_to_chat',
    senderPhoneNumber: '+94770000000',
  });

  // Template Manager State
  const [templates, setTemplates] = useState<NotificationTemplate[]>(DEFAULT_TEMPLATES);
  const [selectedTemplateCode, setSelectedTemplateCode] = useState<NotificationTemplateCode>('appointment_confirmed');
  const [selectedLanguage, setSelectedLanguage] = useState<NotificationLanguage>('si');
  const [editedBody, setEditedBody] = useState('');
  const [editedTitle, setEditedTitle] = useState('');

  // Test Dispatch
  const [testPhoneNumber, setTestPhoneNumber] = useState('+94771234567');
  const [lastDispatchedUrl, setLastDispatchedUrl] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Load Initial Data
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    try {
      const [analyticsData, templatesData, settingsData, logsData] = await Promise.all([
        NotificationService.getAnalytics(),
        NotificationService.getTemplates(),
        NotificationService.getSettings(),
        NotificationService.searchLogs(),
      ]);
      setAnalytics(analyticsData);
      setTemplates(templatesData);
      setSettings(settingsData);
      setLogs(logsData);

      // Select active template
      const current = templatesData.find(
        (t) => t.code === selectedTemplateCode && t.language === selectedLanguage
      ) || templatesData[0];
      if (current) {
        setEditedBody(current.bodyTemplate);
        setEditedTitle(current.title || current.name);
      }
    } catch (err) {
      console.warn('Error loading notification data:', err);
    }
  };

  // Sync editor when template or language changes
  useEffect(() => {
    const current = templates.find(
      (t) => t.code === selectedTemplateCode && t.language === selectedLanguage
    );
    if (current) {
      setEditedBody(current.bodyTemplate);
      setEditedTitle(current.title || current.name);
    } else {
      // Find fallback language
      const fallback = templates.find((t) => t.code === selectedTemplateCode);
      if (fallback) {
        setEditedBody(fallback.bodyTemplate);
        setEditedTitle(fallback.title || fallback.name);
      }
    }
  }, [selectedTemplateCode, selectedLanguage, templates]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Save Template Changes
  const handleSaveTemplate = () => {
    startTransition(async () => {
      const res = await NotificationService.saveTemplate({
        code: selectedTemplateCode,
        language: selectedLanguage,
        title: editedTitle,
        bodyTemplate: editedBody,
      });
      if (res.success) {
        showToast('✅ Template saved successfully!');
        const updated = await NotificationService.getTemplates();
        setTemplates(updated);
      } else {
        showToast(`❌ Error saving template: ${res.error}`);
      }
    });
  };

  // Save Settings Changes
  const handleToggleSetting = (field: keyof NotificationSettings, value: any) => {
    const newSettings = { ...settings, [field]: value };
    setSettings(newSettings);
    startTransition(async () => {
      const res = await NotificationService.saveSettings(newSettings);
      if (res.success) {
        showToast('✅ Settings updated');
      }
    });
  };

  // Insert Variable Token into Editor
  const handleInsertToken = (token: string) => {
    setEditedBody((prev) => `${prev} {{${token}}}`);
  };

  // Send Test Notification
  const handleSendTest = async () => {
    if (!testPhoneNumber) {
      showToast('❌ Please enter a phone number');
      return;
    }

    startTransition(async () => {
      const res = await NotificationService.sendTestMessage(
        testPhoneNumber,
        selectedTemplateCode,
        selectedLanguage
      );

      if (res.success) {
        playNotificationChime();
        setLastDispatchedUrl(res.whatsappUrl);
        showToast(`✅ Test message queued for ${testPhoneNumber}!`);
        const updatedLogs = await NotificationService.searchLogs();
        setLogs(updatedLogs);
        const updatedAnalytics = await NotificationService.getAnalytics();
        setAnalytics(updatedAnalytics);
      }
    });
  };

  // Flush Queue manually
  const handleFlushQueue = async () => {
    startTransition(async () => {
      const res = await NotificationService.processQueue();
      showToast(`⚡ Dispatched ${res.processedCount} queued messages!`);
      const updatedAnalytics = await NotificationService.getAnalytics();
      setAnalytics(updatedAnalytics);
      const updatedLogs = await NotificationService.searchLogs();
      setLogs(updatedLogs);
    });
  };

  // Sample rendered preview for WhatsApp Bubble
  const previewRendered = NotificationService.renderTemplate(editedBody, {
    customer_name: 'Kasun Perera',
    salon_name: 'The Royal Blade',
    date: '2026-11-03',
    time: '10:30 AM',
    barber_name: 'Master Kavi (Chair 01)',
    appointment_number: 'APT-20261103-0001',
    queue_number: '#07',
    chair_number: '01',
    ahead_count: '2',
    estimated_wait_time: '25',
    invoice_number: 'INV-2026-000001',
    payment_amount: '1,800.00',
    payment_method: 'Cash',
    receipt_url: 'https://smartsalon.lk/receipt/INV-2026-000001',
  });

  return (
    <div className="min-h-screen bg-surface text-on-surface flex flex-col font-body pb-12 selection:bg-primary/20">
      {/* ============================================================== */}
      {/* 1. TOP APP BAR                                                 */}
      {/* ============================================================== */}
      <header className="sticky top-0 z-40 bg-surface-container-low/95 backdrop-blur-md border-b border-surface-container-high px-4 py-3 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-2xl bg-[#25D366] text-white flex items-center justify-center font-bold shadow-sm">
              <span className="material-symbols-outlined text-[26px]">chat</span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="font-title-md font-bold text-primary tracking-tight">
                  WhatsApp Communication Center
                </h1>
                <span className="px-2 py-0.5 text-[10px] uppercase font-bold tracking-wider rounded-md bg-[#25D366]/20 text-emerald-700 dark:text-emerald-400">
                  Cloud Engine v2.0
                </span>
              </div>
              <p className="text-xs text-on-surface-variant">
                Smart Salon LK • Automated Customer Engagement &amp; Delivery Tracking
              </p>
            </div>
          </div>

          {/* Quick Shortcuts */}
          <div className="flex items-center gap-2">
            <Link
              href="/reports"
              className="px-3 py-1.5 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary text-xs font-semibold flex items-center gap-1 transition"
              title="Business Intelligence Reports"
            >
              <span className="material-symbols-outlined text-[16px]">monitoring</span>
              <span>Reports</span>
            </Link>
            <Link
              href="/pos"
              className="px-3 py-1.5 rounded-xl border border-surface-container-highest hover:bg-surface-container-high text-xs font-semibold flex items-center gap-1 transition"
            >
              <span className="material-symbols-outlined text-[16px]">point_of_sale</span>
              <span>Billing POS</span>
            </Link>
            <Link
              href="/queue"
              className="px-3 py-1.5 rounded-xl border border-surface-container-highest hover:bg-surface-container-high text-xs font-semibold flex items-center gap-1 transition"
            >
              <span className="material-symbols-outlined text-[16px]">hourglass_empty</span>
              <span>Live Queue</span>
            </Link>
            <button
              type="button"
              onClick={handleFlushQueue}
              disabled={isPending}
              className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold flex items-center gap-1.5 transition shadow-xs"
            >
              <span className="material-symbols-outlined text-[16px]">sync</span>
              <span>Flush Outbox</span>
            </button>
          </div>
        </div>
      </header>

      {/* ============================================================== */}
      {/* 2. TOAST MESSAGE                                              */}
      {/* ============================================================== */}
      {toastMessage && (
        <div className="fixed top-18 right-4 z-50 bg-primary text-on-primary px-4 py-3 rounded-2xl shadow-xl flex items-center gap-3 animate-bounce">
          <span className="material-symbols-outlined text-[20px]">verified</span>
          <span className="text-sm font-semibold">{toastMessage}</span>
        </div>
      )}

      {/* ============================================================== */}
      {/* 3. MAIN COCKPIT TABS & KPI HERO STRIP                         */}
      {/* ============================================================== */}
      <main className="max-w-7xl mx-auto w-full px-4 pt-4 flex flex-col gap-5">
        {/* KPI Summary Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-surface-container-low p-4 rounded-3xl border border-surface-container-high/60 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block">
                Messages Dispatched
              </span>
              <div className="font-extrabold text-2xl text-primary mt-0.5">
                {analytics?.totalSent ?? 26}
              </div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">send</span>
            </div>
          </div>

          <div className="bg-surface-container-low p-4 rounded-3xl border border-surface-container-high/60 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block">
                Delivery Success Rate
              </span>
              <div className="font-extrabold text-2xl text-emerald-600 mt-0.5">
                {analytics?.deliveryRate ?? 98.4}%
              </div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">done_all</span>
            </div>
          </div>

          <div className="bg-surface-container-low p-4 rounded-3xl border border-surface-container-high/60 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block">
                Read Receipts
              </span>
              <div className="font-extrabold text-2xl text-blue-600 mt-0.5">
                {analytics?.read ?? 19}
              </div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">visibility</span>
            </div>
          </div>

          <div className="bg-surface-container-low p-4 rounded-3xl border border-surface-container-high/60 shadow-xs flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant block">
                Pending Queue
              </span>
              <div className="font-extrabold text-2xl text-amber-600 mt-0.5">
                {analytics?.pendingQueue ?? 0}
              </div>
            </div>
            <div className="w-10 h-10 rounded-2xl bg-amber-500/10 text-amber-600 flex items-center justify-center">
              <span className="material-symbols-outlined text-[20px]">schedule</span>
            </div>
          </div>
        </div>

        {/* Navigation Tabs Bar */}
        <div className="flex items-center gap-2 border-b border-surface-container-high pb-2">
          <button
            type="button"
            onClick={() => setActiveTab('templates')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'templates'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface hover:bg-surface-container-high text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">edit_note</span>
            <span>Message Templates</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('outbox')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'outbox'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface hover:bg-surface-container-high text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">outbox</span>
            <span>Delivery Logs &amp; Outbox</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('settings')}
            className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-1.5 ${
              activeTab === 'settings'
                ? 'bg-primary text-on-primary shadow-xs'
                : 'bg-surface hover:bg-surface-container-high text-on-surface'
            }`}
          >
            <span className="material-symbols-outlined text-[16px]">tune</span>
            <span>Owner Settings</span>
          </button>
        </div>

        {/* ============================================================ */}
        {/* TAB 1: TEMPLATE MANAGER & PREVIEW COCKPIT                     */}
        {/* ============================================================ */}
        {activeTab === 'templates' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Template Selector Strip (4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-3">
              <div className="bg-surface-container-low p-4 rounded-3xl border border-surface-container-high/60 shadow-xs">
                <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-3">
                  Lifecycle Event Trigger
                </span>

                <div className="space-y-1.5">
                  {templates.map((tmpl) => {
                    const isSelected = tmpl.code === selectedTemplateCode;
                    return (
                      <button
                        key={`${tmpl.code}-${tmpl.language}`}
                        type="button"
                        onClick={() => {
                          setSelectedTemplateCode(tmpl.code);
                          setSelectedLanguage(tmpl.language);
                        }}
                        className={`w-full text-left p-3 rounded-2xl border transition flex items-center justify-between ${
                          isSelected
                            ? 'bg-primary/10 border-primary text-primary shadow-xs'
                            : 'bg-surface hover:bg-surface-container border-surface-container-highest text-on-surface'
                        }`}
                      >
                        <div className="flex items-center gap-2.5">
                          <span className="material-symbols-outlined text-[20px]">
                            {TEMPLATE_ICONS[tmpl.code] || 'chat'}
                          </span>
                          <div>
                            <div className="text-xs font-bold">{tmpl.name}</div>
                            <div className="text-[10px] text-on-surface-variant uppercase font-medium">
                              {tmpl.category} • {tmpl.language.toUpperCase()}
                            </div>
                          </div>
                        </div>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                            tmpl.language === 'si'
                              ? 'bg-amber-500/10 text-amber-700'
                              : 'bg-blue-500/10 text-blue-700'
                          }`}
                        >
                          {tmpl.language === 'si' ? 'සිංහල' : 'EN'}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Language Switcher */}
              <div className="bg-surface-container-low p-3.5 rounded-3xl border border-surface-container-high/60 shadow-xs flex items-center justify-between">
                <span className="text-xs font-semibold text-on-surface-variant">Language Variant</span>
                <div className="flex gap-1.5">
                  <button
                    type="button"
                    onClick={() => setSelectedLanguage('si')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                      selectedLanguage === 'si'
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface text-on-surface'
                    }`}
                  >
                    සිංහල (Sinhala)
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedLanguage('en')}
                    className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                      selectedLanguage === 'en'
                        ? 'bg-primary text-on-primary'
                        : 'bg-surface text-on-surface'
                    }`}
                  >
                    English
                  </button>
                </div>
              </div>
            </div>

            {/* Middle: Template Editor (4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="bg-surface-container-low p-5 rounded-3xl border border-surface-container-high/60 shadow-xs flex-1 flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant">
                      Template Message Editor
                    </span>
                    <span className="text-[11px] font-mono font-bold text-primary">
                      {selectedTemplateCode}
                    </span>
                  </div>

                  <div className="mb-3">
                    <label className="text-[11px] font-semibold text-on-surface-variant block mb-1">
                      Template Title / Subject
                    </label>
                    <input
                      type="text"
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="w-full px-3 py-1.5 bg-surface rounded-xl border border-surface-container-highest text-xs font-bold"
                    />
                  </div>

                  {/* Token Pills */}
                  <div className="mb-3">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant block mb-1.5">
                      Available Dynamic Tokens (Click to insert):
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {[
                        'customer_name',
                        'salon_name',
                        'date',
                        'time',
                        'barber_name',
                        'appointment_number',
                        'queue_number',
                        'chair_number',
                        'estimated_wait_time',
                        'invoice_number',
                        'payment_amount',
                        'receipt_url',
                      ].map((token) => (
                        <button
                          key={token}
                          type="button"
                          onClick={() => handleInsertToken(token)}
                          className="px-2 py-0.5 rounded-lg bg-surface border border-surface-container-highest hover:bg-primary/10 hover:border-primary text-[10px] font-mono text-primary transition"
                        >
                          +{token}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Editor Textarea */}
                  <div>
                    <label className="text-[11px] font-semibold text-on-surface-variant block mb-1">
                      Message Content (Supports WhatsApp *bold*, _italic_, emojis)
                    </label>
                    <textarea
                      rows={9}
                      value={editedBody}
                      onChange={(e) => setEditedBody(e.target.value)}
                      className="w-full p-3 bg-surface rounded-2xl border border-surface-container-highest text-xs font-mono leading-relaxed focus:outline-none focus:border-primary"
                    />
                  </div>
                </div>

                <div className="mt-4 pt-3 border-t border-surface-container-high flex justify-end">
                  <button
                    type="button"
                    onClick={handleSaveTemplate}
                    disabled={isPending}
                    className="px-5 py-2.5 rounded-2xl bg-primary hover:bg-primary-dim text-on-primary text-xs font-bold transition flex items-center gap-1.5 shadow-xs"
                  >
                    <span className="material-symbols-outlined text-[16px]">save</span>
                    <span>Save Template</span>
                  </button>
                </div>
              </div>
            </div>

            {/* Right: WhatsApp Authentic Chat Bubble Preview (4 cols) */}
            <div className="lg:col-span-4 flex flex-col gap-4">
              <div className="bg-surface-container-low p-5 rounded-3xl border border-surface-container-high/60 shadow-xs flex flex-col justify-between">
                <div>
                  <span className="text-xs font-bold uppercase tracking-wider text-on-surface-variant block mb-3">
                    Customer WhatsApp Phone Preview
                  </span>

                  {/* Realistic WhatsApp Phone Screen Mockup */}
                  <div className="rounded-3xl overflow-hidden border-2 border-surface-container-highest shadow-lg bg-[#EFEAE2] dark:bg-[#0B141A]">
                    {/* WhatsApp Top Header Bar */}
                    <div className="bg-[#075E54] text-white px-3.5 py-2.5 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center font-bold text-xs">
                          ✂️
                        </div>
                        <div>
                          <div className="text-xs font-bold leading-tight">The Royal Blade LK</div>
                          <div className="text-[10px] text-emerald-200">Official Business Account</div>
                        </div>
                      </div>
                      <span className="material-symbols-outlined text-[18px]">verified</span>
                    </div>

                    {/* Chat Bubble Area */}
                    <div className="p-4 min-h-[260px] flex flex-col justify-end">
                      <div className="bg-[#DCF8C6] dark:bg-[#005C4B] text-[#111B21] dark:text-[#E9EDEF] p-3 rounded-2xl rounded-tr-xs max-w-[90%] self-end shadow-xs text-xs whitespace-pre-wrap leading-relaxed relative font-sans">
                        {previewRendered}
                        <div className="flex items-center justify-end gap-1 text-[10px] text-gray-500 dark:text-gray-400 mt-1.5">
                          <span>10:45 AM</span>
                          <span className="text-[#34B7F1] font-bold">✓✓</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Direct Test Dispatch Box */}
                <div className="mt-4 pt-4 border-t border-surface-container-high space-y-2.5">
                  <span className="text-xs font-bold block text-on-surface">
                    Send Live Test Notification
                  </span>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={testPhoneNumber}
                      onChange={(e) => setTestPhoneNumber(e.target.value)}
                      placeholder="+9477XXXXXXX"
                      className="flex-1 px-3 py-2 bg-surface rounded-xl border border-surface-container-highest text-xs font-mono font-bold"
                    />
                    <button
                      type="button"
                      onClick={handleSendTest}
                      disabled={isPending}
                      className="px-4 py-2 rounded-xl bg-[#25D366] hover:bg-[#20ba59] text-white text-xs font-bold transition flex items-center gap-1 shadow-xs"
                    >
                      <span className="material-symbols-outlined text-[16px]">send</span>
                      <span>Send</span>
                    </button>
                  </div>

                  {lastDispatchedUrl && (
                    <a
                      href={lastDispatchedUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="block text-center py-2 px-3 rounded-xl bg-surface border border-emerald-500/30 text-emerald-700 dark:text-emerald-400 text-xs font-semibold hover:bg-emerald-500/10 transition"
                    >
                      📲 Click to open in WhatsApp Web / App
                    </a>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 2: OUTBOX & DELIVERY AUDIT LOGS                          */}
        {/* ============================================================ */}
        {activeTab === 'outbox' && (
          <div className="bg-surface-container-low p-5 rounded-3xl border border-surface-container-high/60 shadow-xs flex flex-col gap-4">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">outbox</span>
                <h3 className="font-title-md font-bold">Notification Delivery Logs</h3>
                <span className="text-xs text-on-surface-variant font-mono">
                  ({logs.length} logged messages)
                </span>
              </div>

              {/* Filters */}
              <div className="flex items-center gap-2 w-full sm:w-auto">
                <input
                  type="text"
                  placeholder="Search phone, customer, event..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="px-3 py-1.5 bg-surface rounded-xl border border-surface-container-highest text-xs w-full sm:w-56"
                />
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="px-3 py-1.5 bg-surface rounded-xl border border-surface-container-highest text-xs font-bold"
                >
                  <option value="all">All Statuses</option>
                  <option value="delivered">Delivered</option>
                  <option value="read">Read</option>
                  <option value="sent">Sent</option>
                  <option value="failed">Failed</option>
                </select>
              </div>
            </div>

            {/* Logs Table */}
            <div className="overflow-x-auto rounded-2xl border border-surface-container-high">
              <table className="w-full text-left text-xs">
                <thead className="bg-surface-container border-b border-surface-container-high font-bold text-on-surface-variant uppercase text-[10px]">
                  <tr>
                    <th className="p-3">Recipient</th>
                    <th className="p-3">Event / Template</th>
                    <th className="p-3">Channel</th>
                    <th className="p-3">Message Snippet</th>
                    <th className="p-3">Status</th>
                    <th className="p-3">Timestamp</th>
                    <th className="p-3 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-surface-container-high/50 bg-surface">
                  {logs
                    .filter((l) => {
                      if (statusFilter !== 'all' && l.status !== statusFilter) return false;
                      if (searchQuery) {
                        const q = searchQuery.toLowerCase();
                        return (
                          l.recipientPhone.toLowerCase().includes(q) ||
                          l.customerName?.toLowerCase().includes(q) ||
                          l.templateCode.toLowerCase().includes(q) ||
                          l.messageBody.toLowerCase().includes(q)
                        );
                      }
                      return true;
                    })
                    .map((item) => (
                      <tr key={item.id} className="hover:bg-surface-container-low transition">
                        <td className="p-3 font-semibold">
                          <div>{item.customerName || 'Customer'}</div>
                          <div className="text-[11px] font-mono text-on-surface-variant">
                            {item.recipientPhone}
                          </div>
                        </td>
                        <td className="p-3">
                          <span className="font-mono text-xs font-bold text-primary">
                            {item.templateCode}
                          </span>
                        </td>
                        <td className="p-3">
                          <span className="uppercase text-[10px] font-bold px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600">
                            {item.channel}
                          </span>
                        </td>
                        <td className="p-3 max-w-xs truncate text-on-surface-variant">
                          {item.messageBody}
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase flex items-center gap-1 w-fit ${
                              item.status === 'read'
                                ? 'bg-blue-500/10 text-blue-600'
                                : item.status === 'delivered'
                                ? 'bg-emerald-500/10 text-emerald-600'
                                : item.status === 'failed'
                                ? 'bg-error-container/20 text-error'
                                : 'bg-surface-container-highest text-on-surface-variant'
                            }`}
                          >
                            <span className="material-symbols-outlined text-[12px]">
                              {item.status === 'read'
                                ? 'done_all'
                                : item.status === 'delivered'
                                ? 'done'
                                : 'schedule'}
                            </span>
                            <span>{item.status}</span>
                          </span>
                        </td>
                        <td className="p-3 text-[11px] text-on-surface-variant font-mono">
                          {new Date(item.createdAt).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </td>
                        <td className="p-3 text-right">
                          <a
                            href={NotificationService.generateWhatsAppUrl(
                              item.recipientPhone,
                              item.messageBody
                            )}
                            target="_blank"
                            rel="noreferrer"
                            className="p-1.5 rounded-lg hover:bg-surface-container text-primary inline-flex"
                            title="Resend via WhatsApp"
                          >
                            <span className="material-symbols-outlined text-[16px]">open_in_new</span>
                          </a>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ============================================================ */}
        {/* TAB 3: SALON OWNER SETTINGS                                  */}
        {/* ============================================================ */}
        {activeTab === 'settings' && (
          <div className="max-w-3xl mx-auto w-full bg-surface-container-low p-6 rounded-3xl border border-surface-container-high/60 shadow-xs flex flex-col gap-6">
            <div className="border-b border-surface-container-high pb-3">
              <h3 className="font-title-md font-bold text-on-surface">
                Owner Notification Settings &amp; Channel Preferences
              </h3>
              <p className="text-xs text-on-surface-variant">
                Control which automated WhatsApp triggers are enabled for customers.
              </p>
            </div>

            {/* Toggle Switches */}
            <div className="space-y-4">
              <div className="flex items-center justify-between p-3.5 bg-surface rounded-2xl border border-surface-container-high">
                <div>
                  <div className="font-bold text-xs">Appointment Messages</div>
                  <div className="text-[11px] text-on-surface-variant">
                    Send booking confirmation, date/time details, and cancellation alerts.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableAppointmentMessages}
                  onChange={(e) =>
                    handleToggleSetting('enableAppointmentMessages', e.target.checked)
                  }
                  className="w-5 h-5 accent-primary cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-surface rounded-2xl border border-surface-container-high">
                <div>
                  <div className="font-bold text-xs">Live Queue &amp; Now Serving Alerts</div>
                  <div className="text-[11px] text-on-surface-variant">
                    Send real-time queue position updates and seat-calling notifications.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableQueueMessages}
                  onChange={(e) => handleToggleSetting('enableQueueMessages', e.target.checked)}
                  className="w-5 h-5 accent-primary cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-surface rounded-2xl border border-surface-container-high">
                <div>
                  <div className="font-bold text-xs">Digital Invoices &amp; Payment Receipts</div>
                  <div className="text-[11px] text-on-surface-variant">
                    Automatically dispatch thermal invoice links and payment confirmation messages.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableInvoiceMessages}
                  onChange={(e) => handleToggleSetting('enableInvoiceMessages', e.target.checked)}
                  className="w-5 h-5 accent-primary cursor-pointer"
                />
              </div>

              <div className="flex items-center justify-between p-3.5 bg-surface rounded-2xl border border-surface-container-high">
                <div>
                  <div className="font-bold text-xs">Upcoming Visit Reminders</div>
                  <div className="text-[11px] text-on-surface-variant">
                    Notify customers ahead of their scheduled booking time.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.enableReminderMessages}
                  onChange={(e) => handleToggleSetting('enableReminderMessages', e.target.checked)}
                  className="w-5 h-5 accent-primary cursor-pointer"
                />
              </div>

              {/* Lead Time Dropdown */}
              <div className="p-3.5 bg-surface rounded-2xl border border-surface-container-high flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs">Reminder Lead Time</div>
                  <div className="text-[11px] text-on-surface-variant">
                    How many minutes before the appointment to send the reminder.
                  </div>
                </div>
                <select
                  value={settings.reminderLeadMinutes}
                  onChange={(e) =>
                    handleToggleSetting('reminderLeadMinutes', Number(e.target.value))
                  }
                  className="px-3 py-1.5 bg-surface-container-low rounded-xl border border-surface-container-highest text-xs font-bold"
                >
                  <option value={30}>30 Minutes Before</option>
                  <option value={60}>1 Hour Before (Recommended)</option>
                  <option value={120}>2 Hours Before</option>
                  <option value={1440}>1 Day Before</option>
                </select>
              </div>

              {/* SMS Fallback */}
              <div className="flex items-center justify-between p-3.5 bg-surface rounded-2xl border border-surface-container-high">
                <div>
                  <div className="font-bold text-xs">SMS Backup Fallback (NotifyLK / Dialog)</div>
                  <div className="text-[11px] text-on-surface-variant">
                    Automatically retry over SMS if customer has no WhatsApp connectivity.
                  </div>
                </div>
                <input
                  type="checkbox"
                  checked={settings.smsFallbackEnabled}
                  onChange={(e) => handleToggleSetting('smsFallbackEnabled', e.target.checked)}
                  className="w-5 h-5 accent-primary cursor-pointer"
                />
              </div>

              {/* Provider Selection */}
              <div className="p-3.5 bg-surface rounded-2xl border border-surface-container-high flex items-center justify-between">
                <div>
                  <div className="font-bold text-xs">WhatsApp Dispatch Engine</div>
                  <div className="text-[11px] text-on-surface-variant">
                    Select how outgoing messages are delivered to customers.
                  </div>
                </div>
                <select
                  value={settings.whatsappProvider}
                  onChange={(e) =>
                    handleToggleSetting('whatsappProvider', e.target.value as any)
                  }
                  className="px-3 py-1.5 bg-surface-container-low rounded-xl border border-surface-container-highest text-xs font-bold"
                >
                  <option value="click_to_chat">wa.me Deep Link (Zero Cost / Instant)</option>
                  <option value="meta_cloud_api">Meta WhatsApp Cloud API (Automated)</option>
                  <option value="simulated">Local Simulation (Offline / Testing)</option>
                </select>
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

