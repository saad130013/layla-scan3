
import React, { useState } from 'react';
import { Inspector, VisitRecord, AreaData, Worker, Language, TRANSLATIONS } from '../types';
import { FileSpreadsheet, Printer, CheckCircle2, Clock, AlertCircle, TrendingUp, Download, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
// @ts-ignore
import html2pdf from 'html2pdf.js';

interface Props {
  language: Language;
  inspectors: Inspector[];
  visits: VisitRecord[];
  areas: AreaData[];
  workers: Worker[];
}

const ReportingScreen: React.FC<Props> = ({ language, inspectors, visits, areas, workers }) => {
  const [isGenerating, setIsGenerating] = useState<string | null>(null);
  const isRtl = language === 'ar';

  const t = {
    en: {
      title: 'Management Reports',
      desc: 'High-level coverage analysis and field inspection documents.',
      export: 'Export Excel',
      print: 'Print Dashboard',
      cov: 'Weekly Coverage',
      comp: 'Visits Completed',
      overdue: 'Overdue Locs',
      activeIns: 'Active Inspectors',
      log: 'Recent Visit Log',
      loc: 'Location',
      ins: 'Inspector',
      var: 'Variance',
      date: 'Date',
      audit: 'Audit Trail',
      noVisits: 'No visits recorded yet.',
      prioOverdue: 'Overdue Priority Locations',
      actionReq: 'Action Required',
      never: 'NEVER VISITED',
      fieldSheets: 'Inspector Field Sheets',
      downloadPDF: 'Download PDF for Email',
      generating: 'Generating PDF...',
      sheetSubtitle: 'Download worker lists for site visits to send via email.',
      workerId: 'ID#',
      workerName: 'EMP Name',
      nationality: 'Nationality',
      company: 'Company',
      position: 'Position',
      signature: 'Signature/Sig',
      totalLocs: 'Total Locations',
      totalWrks: 'Total Workers',
      officialTitle: 'FIELD INSPECTION RECORD',
      reportDate: 'Report Date',
      footerText: 'البرنامج لإدارة الخدمات البيئية - ليلى العتيبي'
    },
    ar: {
      title: 'تقارير الإدارة',
      desc: 'تحليل مستوى التغطية ومستندات التفتيش الميداني.',
      export: 'تصدير إكسل',
      print: 'طباعة الملخص',
      cov: 'التغطية الأسبوعية',
      comp: 'الزيارات المكتملة',
      overdue: 'مواقع متأخرة',
      activeIns: 'المفتشين النشطين',
      log: 'سجل الزيارات الأخير',
      loc: 'الموقع',
      ins: 'المفتش',
      var: 'الانحراف',
      date: 'التاريخ',
      audit: 'سجل المراجعة',
      noVisits: 'لا توجد زيارات مسجلة بعد.',
      prioOverdue: 'مواقع متأخرة ذات أولوية',
      actionReq: 'مطلوب إجراء',
      never: 'لم تتم زيارته قط',
      fieldSheets: 'كشوف التفتيش الميداني',
      downloadPDF: 'تحميل ملف PDF للإرسال',
      generating: 'جاري إنتاج الملف...',
      sheetSubtitle: 'تحميل قائمة مفصلة بأسماء العمال لكل موقع لإرسالها للمفتش.',
      workerId: 'رقم الهوية',
      workerName: 'اسم الموظف',
      nationality: 'الجنسية',
      company: 'الشركة',
      position: 'المسمى الوظيفي',
      signature: 'التوقيع',
      totalLocs: 'إجمالي المواقع',
      totalWrks: 'إجمالي العمالة',
      officialTitle: 'سجل التفتيش الميداني المعتمد',
      reportDate: 'تاريخ التقرير',
      footerText: 'البرنامج لإدارة الخدمات البيئية - ليلى العتيبي'
    }
  }[language];

  const allLocations = areas.flatMap(a => a.locations);
  const totalLocations = allLocations.length;
  const visitedThisWeek = new Set(visits.filter(v => v.visited).map(v => v.locationId)).size;
  const coveragePercent = totalLocations > 0 ? Math.round((visitedThisWeek / totalLocations) * 100) : 0;
  
  const overdueLocations = allLocations.filter(loc => {
    const lastVisit = [...visits].reverse().find(v => v.locationId === loc.id);
    if (!lastVisit) return true;
    const daysSince = (new Date().getTime() - new Date(lastVisit.date).getTime()) / (1000 * 3600 * 24);
    return daysSince > 14;
  });

  const handleDownloadPDF = async (inspector: Inspector) => {
    setIsGenerating(inspector.Inspector_ID);
    
    const element = document.createElement('div');
    element.dir = isRtl ? 'rtl' : 'ltr';
    element.className = 'pdf-render-root';
    element.style.width = '100%';

    const totalLocsCount = inspector.LocationQueue.length;
    const totalWrksCount = inspector.LocationQueue.reduce((acc, locId) => {
      const loc = allLocations.find(l => l.id === locId);
      return acc + (loc?.workerIds.length || 0);
    }, 0);
    
    let htmlContent = `
      <style>
        .pdf-render-root { 
          font-family: 'Inter', Arial, sans-serif; 
          color: #1e293b; 
          margin: 0; padding: 0;
          font-size: 8pt;
        }

        /* 15mm Margins Rule via CSS if needed, but handled by opt.margin */
        
        .location-block { 
          page-break-inside: avoid !important;
          break-inside: avoid-page !important;
          margin-bottom: 25px; 
          border: 1px solid #94a3b8;
          border-radius: 4px;
          overflow: hidden;
          background-color: white;
        }

        /* Essential for multi-page tables */
        table { 
          width: 100%; 
          border-collapse: collapse; 
          page-break-inside: auto; 
        }
        
        /* Force headers to repeat if table spans pages */
        thead { display: table-header-group; }
        
        /* STRICT: No row splits */
        tr { 
          page-break-inside: avoid !important; 
          break-inside: avoid !important; 
        }

        .official-header { border-bottom: 3px solid #1e293b; padding-bottom: 12px; margin-bottom: 15px; }
        .header-grid { display: flex; justify-content: space-between; align-items: center; }
        
        .summary-box { 
          background: #f1f5f9; 
          border: 1px solid #cbd5e1; 
          padding: 10px; 
          margin-bottom: 20px; 
          display: flex; 
          justify-content: space-around;
        }
        .summary-item { text-align: center; }
        .summary-label { font-size: 7pt; color: #475569; font-weight: bold; text-transform: uppercase; }
        .summary-value { font-size: 11pt; font-weight: 800; color: #1e293b; }

        .block-header { 
          background: #1e293b; 
          color: white; 
          padding: 8px 12px; 
          display: flex; 
          justify-content: space-between; 
          font-weight: bold; 
          font-size: 10pt;
        }
        
        .worker-table th, .worker-table td { 
          border: 1px solid #cbd5e1; 
          padding: 6px 10px; 
          text-align: ${isRtl ? 'right' : 'left'}; 
        }
        .worker-table th { background: #f8fafc; font-weight: 800; font-size: 8pt; color: #334155; }
        
        .observations { 
          padding: 10px 12px; 
          font-size: 8pt; 
          color: #64748b; 
          border-top: 1px solid #cbd5e1;
        }

        .footer { 
          text-align: center; 
          font-size: 7.5pt; 
          color: #94a3b8; 
          margin-top: 30px; 
          border-top: 1px solid #e2e8f0;
          padding-top: 10px;
        }
      </style>

      <div class="official-header">
        <div class="header-grid">
          <div class="branding">
            <div style="font-weight: 900; font-size: 16pt; color: #4338ca;">SERVICES INSPECTOR</div>
            <div style="font-size: 8pt; color: #64748b; font-weight: bold;">ENVIRONMENTAL SERVICES DEPARTMENT</div>
          </div>
          <div class="report-title">
            <h1 style="font-size: 14pt; margin: 0; font-weight: 800;">${t.officialTitle}</h1>
          </div>
          <div class="report-meta">
            <div style="font-weight: bold;">${t.reportDate}:</div>
            <div style="font-size: 10pt;">${new Date().toLocaleDateString()}</div>
          </div>
        </div>
      </div>

      <div class="summary-box">
        <div class="summary-item">
          <div class="summary-label">${t.ins}</div>
          <div class="summary-value">${inspector.Inspector_Name}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">${t.totalLocs}</div>
          <div class="summary-value">${totalLocsCount}</div>
        </div>
        <div class="summary-item">
          <div class="summary-label">${t.totalWrks}</div>
          <div class="summary-value">${totalWrksCount}</div>
        </div>
      </div>

      <div class="content-body">
    `;

    for (const locId of inspector.LocationQueue) {
      const loc = allLocations.find(l => l.id === locId);
      if (!loc) continue;
      
      htmlContent += `
        <div class="location-block">
          <div class="block-header">
             <div><span style="opacity: 0.7; font-weight: normal;">${t.loc}:</span> ${loc.name}</div>
             <div style="font-size: 9pt; font-weight: normal;">${isRtl ? 'المنطقة' : 'Area'}: ${loc.area}</div>
          </div>
          
          <table class="worker-table">
            <thead>
              <tr>
                <th style="width: 30px; text-align: center;">#</th>
                <th style="width: 90px;">${t.workerId}</th>
                <th>${t.workerName}</th>
                <th style="width: 80px;">${t.nationality}</th>
                <th style="width: 80px;">${t.company}</th>
                <th style="width: 70px; text-align: center;">${t.signature}</th>
              </tr>
            </thead>
            <tbody>
      `;

      loc.workerIds.forEach((wid, idx) => {
        const worker = workers.find(w => w.Worker_ID === wid);
        htmlContent += `
          <tr>
            <td style="text-align: center; color: #64748b;">${idx + 1}</td>
            <td style="font-weight: bold;">${wid}</td>
            <td style="font-weight: bold; color: #0f172a;">${worker?.Worker_Name || ''}</td>
            <td>${worker?.Nationality || '-'}</td>
            <td>${worker?.Company || '-'}</td>
            <td style="background: #fbfbfb;"></td>
          </tr>
        `;
      });

      htmlContent += `
            </tbody>
          </table>
          <div class="observations">
            ${isRtl ? 'الملاحظات الميدانية:' : 'Field Observations:'} __________________________________________________________________________________
          </div>
        </div>
      `;
    }

    htmlContent += `
      </div>
      <div class="footer">
        ${t.footerText} • ${new Date().getFullYear()} • ${isRtl ? 'تقرير صادر من نظام الخدمات البيئية' : 'Environmental Services Support System'}
      </div>
    `;
    
    element.innerHTML = htmlContent;

    const opt = {
      margin: [15, 10, 15, 10], // STRICT: 15mm Top/Bottom, 10mm Left/Right
      filename: `Visit_Sheet_${inspector.Inspector_Name.replace(/\s+/g, '_')}.pdf`,
      image: { type: 'jpeg', quality: 0.98 },
      html2canvas: { 
        scale: 2, 
        useCORS: true, 
        letterRendering: true,
        logging: false
      },
      jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      pagebreak: { 
        mode: ['css', 'legacy'], // Rely on our explicit break-inside rules
        avoid: '.location-block, tr' 
      }
    };

    try {
      // @ts-ignore
      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error("PDF Generation failed:", error);
    } finally {
      setIsGenerating(null);
    }
  };

  const exportToExcel = () => {
    const data = visits.map(v => {
      const loc = allLocations.find(l => l.id === v.locationId);
      const ins = inspectors.find(i => i.Inspector_ID === v.inspectorId);
      return {
        'Date': new Date(v.date).toLocaleDateString(),
        'Inspector': ins?.Inspector_Name || 'Unknown',
        'Area': loc?.area || 'Unknown',
        'Location': loc?.name || 'Unknown',
        'Expected Workers': loc?.workerIds.length || 0,
        'Actual Workers': v.actualCount || 0,
        'Status': v.visited ? 'Visited' : 'Unvisited',
        'Notes': v.notes || ''
      };
    });
    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Visits");
    XLSX.writeFile(wb, `Ops_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
  };

  return (
    <div className="space-y-8">
      <header className="no-print flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className={isRtl ? 'text-right' : 'text-left'}>
          <h2 className="text-3xl font-bold text-slate-900">{t.title}</h2>
          <p className="text-slate-500 mt-1">{t.desc}</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={exportToExcel} className="flex items-center gap-2 px-5 py-2.5 bg-white border border-slate-200 rounded-lg text-slate-700 font-bold hover:bg-slate-50 transition-colors">
            <FileSpreadsheet className="w-4 h-4 text-emerald-600" /> 
            {t.export}
          </button>
          <button onClick={() => window.print()} className="flex items-center gap-2 px-5 py-2.5 bg-slate-900 text-white rounded-lg font-bold hover:bg-slate-800 transition-colors">
            <Printer className="w-4 h-4" /> 
            {t.print}
          </button>
        </div>
      </header>

      <div className="no-print grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title={t.cov} value={`${coveragePercent}%`} icon={TrendingUp} color="indigo" />
        <StatCard title={t.comp} value={visits.filter(v => v.visited).length} icon={CheckCircle2} color="emerald" />
        <StatCard title={t.overdue} value={overdueLocations.length} icon={AlertCircle} color="amber" />
        <StatCard title={t.activeIns} value={inspectors.length} icon={Clock} color="slate" />
      </div>

      <div className="no-print grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
          <div className="p-6 border-b border-slate-100 bg-indigo-50/30">
            <div className="flex items-center justify-between">
              <div>
                <h4 className="font-bold text-slate-800 text-lg">{t.fieldSheets}</h4>
                <p className="text-sm text-slate-500">{t.sheetSubtitle}</p>
              </div>
              <div className="w-12 h-12 bg-indigo-600 rounded-full flex items-center justify-center text-white shadow-lg shadow-indigo-200">
                <Download className="w-6 h-6" />
              </div>
            </div>
          </div>
          <div className="p-2 space-y-1">
            {inspectors.map(ins => (
              <div key={ins.Inspector_ID} className="flex items-center justify-between p-4 hover:bg-slate-50 rounded-xl transition-all group">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 rounded-full border-2 border-white shadow-sm flex items-center justify-center font-bold text-white text-xs" style={{backgroundColor: ins.Color}}>
                    {ins.Inspector_Name.charAt(0)}
                  </div>
                  <div className={isRtl ? 'text-right' : 'text-left'}>
                    <h5 className="font-bold text-slate-800">{ins.Inspector_Name}</h5>
                    <p className="text-xs text-slate-500">{ins.LocationQueue.length} {t.loc} • {TRANSLATIONS[language][ins.PreferredDay]}</p>
                  </div>
                </div>
                <button 
                  disabled={isGenerating !== null}
                  onClick={() => handleDownloadPDF(ins)}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold transition-all shadow-sm
                    ${isGenerating === ins.Inspector_ID 
                      ? 'bg-slate-100 text-slate-400 cursor-not-allowed' 
                      : 'bg-white border border-indigo-200 text-indigo-700 hover:bg-indigo-600 hover:text-white'}`}
                >
                  {isGenerating === ins.Inspector_ID ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Download className="w-4 h-4" />
                  )}
                  {isGenerating === ins.Inspector_ID ? t.generating : t.downloadPDF}
                </button>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm flex flex-col">
          <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-amber-50/50">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="w-5 h-5" />
              <h4 className="font-bold text-amber-900">{t.prioOverdue}</h4>
            </div>
            <span className="text-[10px] font-bold text-amber-600 uppercase tracking-widest">{t.actionReq}</span>
          </div>
          <div className="flex-1 p-4 space-y-3 overflow-y-auto max-h-[400px]">
            {overdueLocations.map(loc => {
              const lastVisit = [...visits].reverse().find(v => v.locationId === loc.id);
              return (
                <div key={loc.id} className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                  <div className={isRtl ? 'text-right' : 'text-left'}>
                    <h5 className="font-bold text-slate-800">{loc.name}</h5>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">{loc.area}</p>
                  </div>
                  <div className={isRtl ? 'text-left' : 'text-right'}>
                    <p className="text-[10px] font-bold text-slate-400 uppercase mb-1">{t.date}</p>
                    <p className="text-xs font-black text-amber-600">{lastVisit ? new Date(lastVisit.date).toLocaleDateString() : t.never}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon: Icon, color }: any) => (
  <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
    <div className={`w-10 h-10 bg-${color}-50 text-${color}-600 rounded-lg flex items-center justify-center mb-4`}>
      <Icon className="w-6 h-6" />
    </div>
    <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{title}</p>
    <h3 className="text-4xl font-black text-slate-900">{value}</h3>
  </div>
);

export default ReportingScreen;
