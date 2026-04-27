// Классы для работы с нечеткостью

//Функции соотвествия: Гауссова, Колоколообразная, Сигмоидальные Z и S
class MembershipFunction {
    static types = ['gauss', 'bell', 'sigmoid_s', 'sigmoid_z'];
    
    constructor(type, params) {
        this.type = type;
        this.params = { ...params };
    }

    getValue(x) {
        const { type, params } = this;
        switch(type) {
            case 'gauss': 
                return Math.exp(-Math.pow(x - params.mean, 2) / (2 * params.sigma * params.sigma));
            case 'bell': 
                return 1 / (1 + Math.pow(Math.abs((x - params.c) / params.a), 2 * params.b));
            case 'sigmoid_s': 
                return 1 / (1 + Math.exp(-params.k * (x - params.x0)));
            case 'sigmoid_z': 
                return 1 / (1 + Math.exp(params.k * (x - params.x0)));
            default: 
                return 0;
        }
    }

    static getDefaultParams(type, index, totalTerms) {
        const step = 1 / (totalTerms - 1);
        const center = index * step;
        switch(type) {
            case 'gauss': 
                return { mean: center, sigma: step / 2.2 };
            case 'bell': 
                return { a: step / 1.5, b: 2, c: center };
            case 'sigmoid_s': 
                return { x0: Math.max(0, center - step/3), k: 15 };
            case 'sigmoid_z': 
                return { x0: Math.min(1, center + step/3), k: 15 };
            default: 
                return {};
        }
    }

    static getParamFields(type) {
        switch(type) {
            case 'gauss': 
                return [
                    { name: 'mean', label: 'μ (центр):', min: 0, max: 1, step: 0.05 }, 
                    { name: 'sigma', label: 'σ (размах):', min: 0.01, max: 0.5, step: 0.02 }
                ];
            case 'bell': 
                return [
                    { name: 'a', label: 'a (ширина):', step: 0.05 }, 
                    { name: 'b', label: 'b (крутизна):', step: 0.5 }, 
                    { name: 'c', label: 'c (центр):', min: 0, max: 1, step: 0.05 }
                ];
            case 'sigmoid_s': 
            case 'sigmoid_z': 
                return [
                    { name: 'x0', label: 'x₀ (центр):', min: 0, max: 1, step: 0.05 }, 
                    { name: 'k', label: 'k (крутизна):', min: 1, max: 50, step: 5 }
                ];
            default: return [];
        }
    }
}

// Термы Лингвистической Переменной
class Term {
    constructor(name, membershipFunction) {
        this.name = name;
        this.mf = membershipFunction;
    }
}

// Лингвистическая переменная
class LinguisticVariable {
    constructor(name, termNames, defaultMfType = 'gauss') {
        this.name = name;
        this.terms = termNames.map((termName, idx) => 
            new Term(
                termName, 
                new MembershipFunction(
                    defaultMfType, 
                    MembershipFunction.getDefaultParams(defaultMfType, idx, termNames.length)
                )
            )
        );
    }

    getTermCount() { return this.terms.length; }
    getTermName(idx) { return this.terms[idx].name; }
    getMfType(idx) { return this.terms[idx].mf.type; }
    getMfParams(idx) { return this.terms[idx].mf.params; }
    
    setMfType(idx, newType) {
        const newParams = MembershipFunction.getDefaultParams(newType, idx, this.terms.length);
        this.terms[idx].mf = new MembershipFunction(newType, newParams);
    }
    
    updateMfParam(idx, paramName, value) {
        this.terms[idx].mf.params[paramName] = value;
    }
    
    getMembership(x, idx) {
        return this.terms[idx].mf.getValue(x);
    }
    
    defuzzifyTerm(idx, method = 'centroid') {
        let numerator = 0, denominator = 0;
        let maxMu = 0, xValues = [];
        
        for (let x = 0; x <= 1; x += 0.005) {
            const mu = this.getMembership(x, idx);
            if (method === 'centroid') {
                numerator += x * mu;
                denominator += mu;
            } else {
                if (mu > maxMu + 0.001) {
                    maxMu = mu;
                    xValues = [x];
                } else if (Math.abs(mu - maxMu) < 0.001) {
                    xValues.push(x);
                }
            }
        }
        
        if (method === 'centroid') return denominator > 0 ? numerator / denominator : 0.5;
        return xValues.length > 0 ? xValues.reduce((a,b) => a+b, 0) / xValues.length : 0.5;
    }
    
    defuzzifyAllTerms(method = 'centroid') {
        return this.terms.map((_, idx) => this.defuzzifyTerm(idx, method));
    }
}

// Конфигурация
const CONFIG = {
    varX: {
        fullName: 'Возможность интенсивного использования ПО',
        shortName: 'X',
        terms: ["Очень низкая", "Низкая", "Ниже средней", "Средняя", "Выше средней", "Высокая", "Очень высокая"],
        meanRankDefault: 4,
        sigmaRankDefault: 0.6,
        minRank: 1,
        maxRank: 7
    },
    varY: {
        fullName: 'Удобство использования',
        shortName: 'Y',
        terms: ["Абсолютно Неудобно", "Неудобно", "Слегка неудобно", "Нейтрально", "Удобно", "Абсолютно Удобно"],
        meanRankDefault: 4,
        sigmaRankDefault: 0.6,
        minRank: 1,
        maxRank: 6
    },
    expertCountDefault: 10,
    correctionNoiseDefault: 0.2,
    colors: ['#e74c3c', '#e67e22', '#f39c12', '#f1c40f', '#2ecc71', '#27ae60', '#1abc9c', '#3498db', '#9b59b6']
};

// Глобальное состояние

let lingVarX, lingVarY;
let currentVarForFunctions = 'var1';
let lastAnswers = null;
let manualNumericData = null;

// Доп. функции ==============

//Цветовая палитра для функций принадлежности
function getColor(index) {
    return CONFIG.colors[index % CONFIG.colors.length];
}

//Нормальное распределение ответов при генерации (преобразование Бокса - Мюллера)
function normalRandomRank(mean, sigma, minRank, maxRank) {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();

    const z = Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    let rank = mean + sigma * z;
    rank = Math.round(rank);

    return Math.min(maxRank, Math.max(minRank, rank));
}

//Имитация коррекции при генерации через шум
function applyCorrection(value, noiseLevel) {
    if (noiseLevel <= 0) return Math.min(1, Math.max(0, value));
    const delta = (Math.random() * 2 - 1) * noiseLevel;
    return Math.min(1, Math.max(0, value + delta));
}

//Приближение точек к полиному degree-ой степени
function polynomialRegression(xValues, yValues, degree) {
    const n = xValues.length;
    const X = Array(degree + 1).fill().map(() => Array(degree + 1).fill(0));
    const Y = Array(degree + 1).fill(0);
    
    for (let i = 0; i <= degree; i++) {
        for (let j = 0; j <= degree; j++) {
            for (let k = 0; k < n; k++) X[i][j] += Math.pow(xValues[k], i + j);
        }
        for (let k = 0; k < n; k++) Y[i] += yValues[k] * Math.pow(xValues[k], i);
    }
    
    const augmented = X.map((row, i) => [...row, Y[i]]);
    for (let i = 0; i <= degree; i++) {
        let maxRow = i;
        for (let j = i + 1; j <= degree; j++) {
            if (Math.abs(augmented[j][i]) > Math.abs(augmented[maxRow][i])) maxRow = j;
        }
        [augmented[i], augmented[maxRow]] = [augmented[maxRow], augmented[i]];
        for (let j = i + 1; j <= degree; j++) {
            const factor = augmented[j][i] / augmented[i][i];
            for (let k = i; k <= degree + 1; k++) augmented[j][k] -= factor * augmented[i][k];
        }
    }
    
    const coefficients = new Array(degree + 1);
    for (let i = degree; i >= 0; i--) {
        let sum = 0;
        for (let j = i + 1; j <= degree; j++) sum += augmented[i][j] * coefficients[j];
        coefficients[i] = (augmented[i][degree + 1] - sum) / augmented[i][i];
    }

    return coefficients;
}

// Вкладка 0. Основаная
function renderTab0() {
    document.getElementById('varXTitle').textContent = `${CONFIG.varX.shortName} - ${CONFIG.varX.fullName}`;
    document.getElementById('varYTitle').textContent = `${CONFIG.varY.shortName} - ${CONFIG.varY.fullName}`;
    
    const containerX = document.getElementById('varXTermsDisplay');
    const containerY = document.getElementById('varYTermsDisplay');
    
    containerX.innerHTML = lingVarX.terms.map((term, idx) => `
        <div class="term-item"><span class="term-name">#${idx+1}</span><span class="rank-badge">${term.name}</span></div>
    `).join('');
    
    containerY.innerHTML = lingVarY.terms.map((term, idx) => `
        <div class="term-item"><span class="term-name">#${idx+1}</span><span class="rank-badge">${term.name}</span></div>
    `).join('');
}

// Вкладка 1. С функциями соотвествия
function renderVariableSelector() {
    const container = document.getElementById('varSelector');
    container.innerHTML = `
        <button class="var-btn active-var" data-var="var1">${CONFIG.varX.shortName}: ${CONFIG.varX.fullName}</button>
        <button class="var-btn" data-var="var2">${CONFIG.varY.shortName}: ${CONFIG.varY.fullName}</button>
    `;

    document.querySelectorAll('.var-btn').forEach(btn => {
        btn.addEventListener('click', () => switchVariable(btn.getAttribute('data-var')));
    });
}

function buildFunctionsUI(varId) {
    const container = document.getElementById(`functions-${varId}`);
    if (!container) return;

    const lingVar = varId === 'var1' ? lingVarX : lingVarY;
    const termsList = lingVar.terms;
    
    container.innerHTML = '';
    termsList.forEach((term, idx) => {
        const card = document.createElement('div');
        card.className = 'term-card';
        card.innerHTML = `
            <h3>Терм '${term.name}'</h3>
            <div class="term-card-body">
                <div class="param-group">
                    <label>Тип функции:</label>
                    <select onchange="window.changeFunctionType('${varId}', ${idx}, this.value)">
                        ${MembershipFunction.types.map(type => `<option value="${type}" ${lingVar.getMfType(idx) === type ? 'selected' : ''}>${type === 'gauss' ? 'Гауссова' : type === 'bell' ? 'Колоколообразная' : type === 'sigmoid_s' ? 'S-образная' : 'Z-образная'}</option>`).join('')}
                    </select>
                    <div id="params-${varId}-${idx}"></div>
                </div>
                <div id="term-chart-${varId}-${idx}" class="term-chart"></div>
            </div>
        `;
        container.appendChild(card);
    });
    
    for (let i = 0; i < termsList.length; i++) updateParamsUI(varId, i);
    updateAllCharts(varId);
}

function updateParamsUI(varId, idx) {
    const paramsDiv = document.getElementById(`params-${varId}-${idx}`);
    if (!paramsDiv) return;

    const lingVar = varId === 'var1' ? lingVarX : lingVarY;
    const mfType = lingVar.getMfType(idx);
    const params = lingVar.getMfParams(idx);
    const fields = MembershipFunction.getParamFields(mfType);
    
    paramsDiv.innerHTML = fields.map(field => `
        <div class="param-group">
            <label>${field.label}</label>
            <input type="number" value="${params[field.name].toFixed(2)}" step="${field.step || 0.05}" ${field.min !== undefined ? `min="${field.min}"` : ''} ${field.max !== undefined ? `max="${field.max}"` : ''} onchange="window.updateParam('${varId}', ${idx}, '${field.name}', this.value)">
        </div>
    `).join('');
    
    updateTermChart(varId, idx);
}

function updateTermChart(varId, idx) {
    const lingVar = varId === 'var1' ? lingVarX : lingVarY;
    const xValues = [], yValues = [];

    for (let x = 0; x <= 1; x += 0.005) {
        xValues.push(x);
        yValues.push(lingVar.getMembership(x, idx));
    }

    const trace = { 
        x: xValues, 
        y: yValues, 
        mode: 'lines', 
        line: { 
            color: getColor(idx), 
            width: 2 
        }, 
        name: lingVar.getTermName(idx) 
    };

    const layout = { 
        title: lingVar.getTermName(idx), 
        xaxis: { 
            title: 'x', 
            range: [0,1] 
        }, 
        yaxis: { 
            title: 'μ(x)', 
            range: [0,1] 
        }, 
        margin: { l: 40, r: 20, t: 40, b: 40 }, 
        width: 350, 
        height: 250, 
        showlegend: false 
    };

    const chartDiv = document.getElementById(`term-chart-${varId}-${idx}`);
    if (chartDiv) Plotly.newPlot(chartDiv, [trace], layout, { responsive: true, displayModeBar: false });
}

function updateAllCharts(varId) {
    const lingVar = varId === 'var1' ? lingVarX : lingVarY;
    const traces = [];

    for (let i = 0; i < lingVar.getTermCount(); i++) {
        const data = [];
        for (let x = 0; x <= 1; x += 0.005) data.push(lingVar.getMembership(x, i));

        traces.push({ 
            x: Array.from({length:201}, (_,i) => i*0.005), 
            y: data, mode: 'lines', 
            line: { 
                color: getColor(i), 
                width: 2 
            }, 
            name: lingVar.getTermName(i) 
        });
    }

    const layout = { 
        title: `Функции принадлежности`, 
        xaxis: { 
            title: 'Шкала (0-1)', 
            range: [0,1] 
        }, 
        yaxis: { 
            title: 'μ(x)', 
            range: [0,1.1] 
        }, 
        legend: { 
            orientation: 'h', 
            yanchor: 'bottom', 
            y:1.02, 
            xanchor:'center', 
            x:0.5 
        }, 
        margin: { l: 50, r: 30, t: 50, b: 50 } 
    };

    const chartDivId = varId === 'var1' ? 'membershipChart-var1' : 'membershipChart-var2';
    Plotly.newPlot(chartDivId, traces, layout, { responsive: true });
    for (let i = 0; i < lingVar.getTermCount(); i++) updateTermChart(varId, i);
}

// Вкладка 2. Генерация ответов
function renderGenerationSettings() {
    const container = document.getElementById('generationSettings');
    container.innerHTML = `
        <h3>Настройки генерации</h3>
        <div class="settings-row" style="margin-top: 15px;">
            <p>${CONFIG.varX.shortName} - ${CONFIG.varX.fullName}</p>
            <div class="setting-item"><label>Средний ранг (1-${CONFIG.varX.maxRank}):</label><input type="number" id="meanRankVar1" value="${CONFIG.varX.meanRankDefault}" step="0.2" min="1" max="${CONFIG.varX.maxRank}"></div>
            <div class="setting-item"><label>Станд. отклонение ранга</label><input type="number" id="sigmaRankVar1" value="${CONFIG.varX.sigmaRankDefault}" step="0.1" min="0.3" max="3"></div>
        </div>
        <div class="settings-row" style="margin-top: 15px;">
            <p>${CONFIG.varY.shortName} - ${CONFIG.varY.fullName}</p>
            <div class="setting-item"><label>Средний ранг (1-${CONFIG.varY.maxRank}):</label><input type="number" id="meanRankVar2" value="${CONFIG.varY.meanRankDefault}" step="0.2" min="1" max="${CONFIG.varY.maxRank}"></div>
            <div class="setting-item"><label>Станд. отклонение ранга</label><input type="number" id="sigmaRankVar2" value="${CONFIG.varY.sigmaRankDefault}" step="0.1" min="0.3" max="3"></div>
        </div>
        <div class="settings-row" style="margin-top: 15px;">
            <div class="settings-row"><label>Количество экспертов (N):</label><input type="number" id="expertCount" value="${CONFIG.expertCountDefault}" min="1" max="200" step="1"></div>
        </div>
        <div class="settings-row" style="margin-top: 15px;">
            <button id="generateExpertsBtn" style="margin: 0; background: #2c3e50;">Сгенерировать ответы</button>
        </div>
    `;

    document.getElementById('generateExpertsBtn').addEventListener('click', generateExpertsAnswers);
}

function generateExpertsAnswers() {
    const N = parseInt(document.getElementById("expertCount").value);

    const meanRank1 = parseFloat(document.getElementById("meanRankVar1").value);
    const sigmaRank1 = parseFloat(document.getElementById("sigmaRankVar1").value);

    const meanRank2 = parseFloat(document.getElementById("meanRankVar2").value);
    const sigmaRank2 = parseFloat(document.getElementById("sigmaRankVar2").value);
    
    if (isNaN(N) || N < 1) { alert("Укажите корректное количество экспертов (натуральное число)"); return; }
    
    const answers = [];
    const countsVar1 = new Array(lingVarX.getTermCount()).fill(0);
    const countsVar2 = new Array(lingVarY.getTermCount()).fill(0);
    
    for (let i = 0; i < N; i++) {
        const rank1 = normalRandomRank(meanRank1, sigmaRank1, CONFIG.varX.minRank, CONFIG.varX.maxRank);
        const rank2 = normalRandomRank(meanRank2, sigmaRank2, CONFIG.varY.minRank, CONFIG.varY.maxRank);

        answers.push({ 
            expert: i + 1, 
            term1: lingVarX.getTermName(rank1-1), 
            term2: lingVarY.getTermName(rank2-1), 
            rank1, 
            rank2 
        });

        countsVar1[rank1-1]++;
        countsVar2[rank2-1]++;
    }
    
    lastAnswers = answers;
    displayLinguisticResults(answers, countsVar1, countsVar2, N);

    document.getElementById("correctionPanel").classList.add("visible");
    document.getElementById("numericSection").style.display = "none";
}

function displayLinguisticResults(answers, countsVar1, countsVar2, N) {
    document.getElementById('distrTitleVar1').textContent = `${CONFIG.varX.shortName}: Распределение по термам`;
    document.getElementById('distrTitleVar2').textContent = `${CONFIG.varY.shortName}: Распределение по термам`;
    
    const statsContainer = document.getElementById("statsContainer");
    statsContainer.innerHTML = `
        <div class="stat-card">
            <h4>${CONFIG.varX.shortName}: ${CONFIG.varX.fullName}</h4>
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
                <tr style="background:#e0e0e0;"><th>Ранг</th><th>Терм</th><th>Частота</th><th>%</th></tr>
                ${lingVarX.terms.map((term, i) => `<tr><td style="text-align:center">#${i+1}</td><td style="text-align:left">${term.name}</td><td style="text-align:center">${countsVar1[i]}</td><td style="text-align:center">${((countsVar1[i]/N)*100).toFixed(1)}%</td></tr>`).join('')}
            </table>
        </div>
        <div class="stat-card">
            <h4>${CONFIG.varY.shortName}: ${CONFIG.varY.fullName}</h4>
            <table style="width:100%; border-collapse:collapse; font-size:13px;">
                <tr style="background:#e0e0e0;"><th>Ранг</th><th>Терм</th><th>Частота</th><th>%</th></tr>
                ${lingVarY.terms.map((term, i) => `<tr><td style="text-align:center">#${i+1}</td><td style="text-align:left">${term.name}</td><td style="text-align:center">${countsVar2[i]}</td><td style="text-align:center">${((countsVar2[i]/N)*100).toFixed(1)}%</td></tr>`).join('')}
            </table>
        </div>
    `;

    const layout = { 
        title: `Распределение ответов (N=${N})`, 
        xaxis: { 
            title: 'Термы', 
            tickangle: 0 
        }, 
        yaxis: { 
            title: 'Количество экспертов' 
        }, 
        height: 300, 
        margin: { l: 40, r: 20, t: 30, b: 70 } 
    }
    
    const trace1 = { 
        x: lingVarX.terms.map(t => t.name), 
        y: countsVar1, 
        type: 'bar', 
        marker: { 
            color: 'rgba(52, 152, 219, 0.7)', 
            line: { 
                color: '#2980b9', 
                width: 1 
            }
        }, 
        text: countsVar1.map(String), 
        textposition: 'bottom' 
    };

    Plotly.newPlot(
        'distrChartVar1', 
        [trace1], 
        layout, 
        {  responsive: true }
    );
    
    const trace2 = { 
        x: lingVarY.terms.map(t => t.name), 
        y: countsVar2, 
        type: 'bar', 
        marker: { 
            color: 'rgba(46, 204, 113, 0.7)', 
            line: { 
                color: '#27ae60', 
                width: 1 
            } 
        }, 
        text: countsVar2.map(String), 
        textposition: 'bottom' 
    };

    Plotly.newPlot(
        'distrChartVar2', 
        [trace2], 
        layout, 
        { responsive: true }
    );
    
    let tableHtml = `<table><thead><tr><th>Эксперт</th><th>${CONFIG.varX.shortName} - ${CONFIG.varX.fullName}</th><th>${CONFIG.varY.shortName} - ${CONFIG.varY.fullName}</th></tr></thead><tbody>`;
    answers.forEach(ans => { tableHtml += `<tr><td style="text-align:center">Эксперт ${ans.expert}</td><td style="text-align:center">${ans.term1}</td><td style="text-align:center">${ans.term2}</td></tr>`; });
    tableHtml += `</tbody></table>`;

    document.getElementById("tableContainerLinguistic").innerHTML = tableHtml;
    document.getElementById("linguisticSection").style.display = "block";
}

function applyCorrectionAndShow() {
    if (!lastAnswers || lastAnswers.length === 0) {
        alert("Сначала сгенерируйте ответы экспертов");
        return;
    }
    
    const method = document.getElementById("defuzzMethod").value;
    const noiseLevel = parseFloat(document.getElementById("correctionNoise").value);
    
    const termValuesVar1 = lingVarX.defuzzifyAllTerms(method);
    const termValuesVar2 = lingVarY.defuzzifyAllTerms(method);
    
    const termToValueVar1 = Object.fromEntries(lingVarX.terms.map((term, i) => [term.name, termValuesVar1[i]]));
    const termToValueVar2 = Object.fromEntries(lingVarY.terms.map((term, i) => [term.name, termValuesVar2[i]]));
    
    const numericAnswers = lastAnswers.map(ans => ({
        expert: ans.expert,
        crisp1: applyCorrection(termToValueVar1[ans.term1], noiseLevel),
        crisp2: applyCorrection(termToValueVar2[ans.term2], noiseLevel)
    }));
    
    displayNumericResults(numericAnswers, method, noiseLevel);
    
    const methodName = method === 'centroid' ? 'Центр тяжести' : 'Средний максимум';
    document.getElementById("defuzzPreview").innerHTML = `Применён метод "${methodName}", коррекция ±${noiseLevel}`;
}

function displayNumericResults(numericAnswers, method, noiseLevel) {
    let tableHtml = `<table><thead><tr><th>Эксперт</th><th>${CONFIG.varX.shortName} - ${CONFIG.varX.fullName}</th><th>${CONFIG.varY.shortName} - ${CONFIG.varY.fullName}</th></tr></thead><tbody>`;
    numericAnswers.forEach(ans => {
        tableHtml += `<tr><td style="text-align:center">Эксперт ${ans.expert}</td><td style="text-align:center">${ans.crisp1.toFixed(4)}</td><td style="text-align:center">${ans.crisp2.toFixed(4)}</td></tr>`;
    });
    tableHtml += `</tbody></table>`;
    document.getElementById("tableContainerNumeric").innerHTML = tableHtml;
    
    const crisp1Values = numericAnswers.map(a => a.crisp1);
    const crisp2Values = numericAnswers.map(a => a.crisp2);
    const coefficients = polynomialRegression(crisp1Values, crisp2Values, 3);
    
    const xSmooth = [], ySmooth = [];
    for (let x = 0; x <= 1; x += 0.01) {
        xSmooth.push(x);
        let y = coefficients[0] + coefficients[1]*x + coefficients[2]*Math.pow(x,2) + coefficients[3]*Math.pow(x,3);
        ySmooth.push(Math.min(1, Math.max(0, y)));
    }
    
    const scatterTrace = {
        x: crisp1Values, 
        y: crisp2Values, 
        mode: 'markers', 
        type: 'scatter', 
        name: 'Эксперты',
        marker: { 
            size: 12, 
            color: '#e74c3c', 
            opacity: 0.8, 
            line: { 
                color: '#c0392b', 
                width: 1 
            } 
        },
        text: numericAnswers.map(a => `Эксперт ${a.expert}`), hoverinfo: 'text+x+y'
    };
    const regressionTrace = { x: xSmooth, y: ySmooth, mode: 'lines', type: 'scatter', name: 'Аппроксимация (полином 3-й степени)', line: { color: '#2c3e50', width: 1 } };
    
    Plotly.newPlot('scatterPlot', [scatterTrace, regressionTrace], 
        {
            title: { 
                text: `Аппроксимация: Y = ${coefficients[3].toFixed(4)}·X³${coefficients[2]>=0?"+":""}${coefficients[2].toFixed(4)}·X²${coefficients[1]>=0?"+":""}${coefficients[1].toFixed(4)}·X${coefficients[0]>=0?"+":""}${coefficients[0].toFixed(4)}`, 
                font: { size: 16 } 
            },
            xaxis: { 
                title: { 
                    text: `${CONFIG.varX.shortName} - ${CONFIG.varX.fullName}`, 
                    font: { size: 13, weight: 'bold' } 
                }, 
                range: [0,1], 
                gridcolor: '#eee', 
                tickformat: '.2f' 
            },
            yaxis: { 
                title: { 
                    text: `${CONFIG.varY.shortName} - ${CONFIG.varY.fullName}`, 
                    font: { size: 13, weight: 'bold' } 
                }, 
                range: [0,1], 
                gridcolor: '#eee', 
                tickformat: '.2f' 
            },
            hovermode: 'closest', 
            margin: { l: 65, r: 55, t: 70, b: 65 }, 
            showlegend: false, 
            plot_bgcolor: '#fafafa', 
            paper_bgcolor: 'white'
        }, 
        { responsive: true }
    );
    
    document.getElementById("numericSection").style.display = "block";
}

// Вкладка 3. С ручным вводом
function renderManualInputTable() {
    const expertCount = parseInt(document.getElementById('manualExpertCount').value);
    if (isNaN(expertCount) || expertCount < 1) {
        alert('Введите корректное количество экспертов');
        return;
    }
    
    let tableHtml = `<div class="manual-table-container"><table style="table-layout: fixed; width: 100%;">
        <thead>
            <tr>
                <th style="width: 20%; min-width: 100px;">Эксперт</th>
                <th style="width: 40%; min-width: 200px;">${CONFIG.varX.shortName} - ${CONFIG.varX.fullName}</th>
                <th style="width: 40%; min-width: 200px;">${CONFIG.varY.shortName} - ${CONFIG.varY.fullName}</th>
            </tr>
        </thead>
        <tbody>`;
    
    for (let i = 1; i <= expertCount; i++) {
        tableHtml += `<tr>
            <td style="text-align: center; vertical-align: middle;">Эксперт ${i}</td>
            <td style="text-align: center;">
                <select id="manual_term1_${i}" class="manual-term1" style="width: 95%; padding: 8px;">
                    ${lingVarX.terms.map((term, idx) => `<option value="${term.name}">${term.name}</option>`).join('')}
                </select>
            </td>
            <td style="text-align: center;">
                <select id="manual_term2_${i}" class="manual-term2" style="width: 95%; padding: 8px;">
                    ${lingVarY.terms.map((term, idx) => `<option value="${term.name}">${term.name}</option>`).join('')}
                </select>
            </td>
        </tr>`;
    }
    tableHtml += `</tbody></table></div>`;
    
    document.getElementById('manualTableContainer').innerHTML = tableHtml;
    document.getElementById('manualInputSection').style.display = 'block';
    document.getElementById('manualNumericSection').style.display = 'none';
    document.getElementById('manualChartSection').style.display = 'none';
    manualNumericData = null;
}

function convertToNumeric() {
    const expertCount = parseInt(document.getElementById('manualExpertCount').value);
    const method = document.getElementById('manualDefuzzMethod').value;
    
    const termValuesVar1 = lingVarX.defuzzifyAllTerms(method);
    const termValuesVar2 = lingVarY.defuzzifyAllTerms(method);
    
    const termToValueVar1 = Object.fromEntries(lingVarX.terms.map((term, i) => [term.name, termValuesVar1[i]]));
    const termToValueVar2 = Object.fromEntries(lingVarY.terms.map((term, i) => [term.name, termValuesVar2[i]]));
    
    const answers = [];
    for (let i = 1; i <= expertCount; i++) {
        const term1Select = document.getElementById(`manual_term1_${i}`);
        const term2Select = document.getElementById(`manual_term2_${i}`);
        
        if (!term1Select || !term2Select) continue;
        
        const term1 = term1Select.value;
        const term2 = term2Select.value;
        
        answers.push({
            expert: i,
            crisp1: termToValueVar1[term1],
            crisp2: termToValueVar2[term2]
        });
    }
    
    manualNumericData = answers;
    displayManualNumericTable(answers);
    document.getElementById('manualNumericSection').style.display = 'block';
    document.getElementById('manualChartSection').style.display = 'none';
}

function displayManualNumericTable(numericData) {
    let tableHtml = `<div class="numeric-table-container"><table style="table-layout: fixed; width: 100%;">
        <thead>
            <tr>
                <th style="width: 20%; min-width: 100px;">Эксперт</th>
                <th style="width: 40%; min-width: 200px;">${CONFIG.varX.shortName} - ${CONFIG.varX.fullName}</th>
                <th style="width: 40%; min-width: 200px;">${CONFIG.varY.shortName} - ${CONFIG.varY.fullName}</th>
            </tr>
        </thead>
        <tbody>`;
    
    numericData.forEach(ans => {
        tableHtml += `<tr>
            <td style="text-align: center; vertical-align: middle;">Эксперт ${ans.expert}</td>
            <td style="text-align: center;">
                <input type="number" id="numeric_val1_${ans.expert}" value="${ans.crisp1.toFixed(4)}" step="0.01" min="0" max="1" style="width: 90%; padding: 8px; text-align: center;">
            </td>
            <td style="text-align: center;">
                <input type="number" id="numeric_val2_${ans.expert}" value="${ans.crisp2.toFixed(4)}" step="0.01" min="0" max="1" style="width: 90%; padding: 8px; text-align: center;">
            </td>
        </tr>`;
    });
    tableHtml += `</tbody></table></div>`;
    
    document.getElementById('manualNumericTableContainer').innerHTML = tableHtml;
}

function buildManualChart() {
    if (!manualNumericData) {
        alert('Сначала переведите ответы в численные значения');
        return;
    }
    
    const expertCount = parseInt(document.getElementById('manualExpertCount').value);
    const crisp1Values = [];
    const crisp2Values = [];
    
    for (let i = 1; i <= expertCount; i++) {
        const input1 = document.getElementById(`numeric_val1_${i}`);
        const input2 = document.getElementById(`numeric_val2_${i}`);
        
        if (input1 && input2) {
            crisp1Values.push(parseFloat(input1.value) || 0);
            crisp2Values.push(parseFloat(input2.value) || 0);
        }
    }
    
    if (crisp1Values.length === 0) {
        alert('Нет данных для построения графика');
        return;
    }
    
    const coefficients = polynomialRegression(crisp1Values, crisp2Values, 3);
    
    const xSmooth = [], ySmooth = [];
    for (let x = 0; x <= 1; x += 0.01) {
        xSmooth.push(x);
        let y = coefficients[0] + coefficients[1]*x + coefficients[2]*Math.pow(x,2) + coefficients[3]*Math.pow(x,3);
        ySmooth.push(Math.min(1, Math.max(0, y)));
    }
    
    const scatterTrace = {
        x: crisp1Values, 
        y: crisp2Values, 
        mode: 'markers', 
        type: 'scatter', 
        name: 'Эксперты',
        marker: { 
            size: 12, 
            color: '#e74c3c', 
            opacity: 0.8, 
            line: { 
                color: '#c0392b', 
                width: 1 
            } 
        },
        text: crisp1Values.map((_, idx) => `Эксперт ${idx+1}`), hoverinfo: 'text+x+y'
    };

    const regressionTrace = { 
        x: xSmooth, 
        y: ySmooth, 
        mode: 'lines', 
        type: 'scatter', 
        name: 'Аппроксимация (полином 3-й степени)', 
        line: { 
            color: '#2c3e50', 
            width: 1
        } 
    };
    
    Plotly.newPlot('manualScatterPlot', [scatterTrace, regressionTrace], 
        {
            title: { 
                text: `Аппроксимация: Y = ${coefficients[3].toFixed(4)}·X³${coefficients[2]>=0?"+":""}${coefficients[2].toFixed(4)}·X²${coefficients[1]>=0?"+":""}${coefficients[1].toFixed(4)}·X${coefficients[0]>=0?"+":""}${coefficients[0].toFixed(4)}`, 
                font: { size: 16 } 
            },
            xaxis: { 
                title: { 
                    text: `${CONFIG.varX.shortName} - ${CONFIG.varX.fullName}`, 
                    font: { size: 13, weight: 'bold' } 
                }, 
                range: [0,1], 
                gridcolor: '#eee', 
                tickformat: '.2f'
            },
            yaxis: { 
                title: { 
                    text: `${CONFIG.varY.shortName} - ${CONFIG.varY.fullName}`,
                    font: { size: 13, weight: 'bold' } 
                }, 
                range: [0,1], 
                gridcolor: '#eee', 
                tickformat: '.2f' 
            },
            hovermode: 'closest', 
            margin: { l: 65, r: 55, t: 70, b: 65 }, 
            showlegend: false, 
            plot_bgcolor: '#fafafa', 
            paper_bgcolor: 'white'
        }, 
        { responsive: true }
    );
    
    document.getElementById('manualChartSection').style.display = 'block';
}

// Переключение вкладок
function switchMainTab(index) {
    document.querySelectorAll('.content').forEach((el, i) => {
        el.classList.toggle('active', i === index);
    });
    
    if (index === 1) {
        if (document.getElementById('functions-var1').children.length === 0) buildFunctionsUI('var1');
        if (document.getElementById('functions-var2').children.length === 0) buildFunctionsUI('var2');
        updateAllCharts(currentVarForFunctions);
    }
}

function switchVariable(varId) {
    currentVarForFunctions = varId;
    document.querySelectorAll('.var-btn').forEach(btn => btn.classList.toggle('active-var', btn.getAttribute('data-var') === varId));
    document.getElementById('var1-panel').classList.toggle('active-var-panel', varId === 'var1');
    document.getElementById('var2-panel').classList.toggle('active-var-panel', varId === 'var2');

    if (varId === 'var1' && document.getElementById('functions-var1').children.length === 0) buildFunctionsUI('var1');
    else if (varId === 'var2' && document.getElementById('functions-var2').children.length === 0) buildFunctionsUI('var2');
    else updateAllCharts(varId);
}

//Инициализация

window.changeFunctionType = function(varId, idx, newType) {
    const lingVar = varId === 'var1' ? lingVarX : lingVarY;
    lingVar.setMfType(idx, newType);
    updateParamsUI(varId, idx);
    updateAllCharts(varId);
};

window.updateParam = function(varId, idx, paramName, value) {
    const lingVar = varId === 'var1' ? lingVarX : lingVarY;
    lingVar.updateMfParam(idx, paramName, parseFloat(value));
    updateTermChart(varId, idx);
    updateAllCharts(varId);
};

function init() {
    lingVarX = new LinguisticVariable(CONFIG.varX.fullName, CONFIG.varX.terms);
    lingVarY = new LinguisticVariable(CONFIG.varY.fullName, CONFIG.varY.terms);
    
    renderTab0();
    renderVariableSelector();
    renderGenerationSettings();
    
    buildFunctionsUI('var1');
    buildFunctionsUI('var2');
    
    document.querySelectorAll('.tab').forEach(tab => {
        tab.addEventListener('click', () => switchMainTab(parseInt(tab.getAttribute('data-tab'))));
    });
    
    document.getElementById('applyCorrectionBtn').addEventListener('click', applyCorrectionAndShow);
    document.getElementById('createManualTableBtn').addEventListener('click', renderManualInputTable);
    document.getElementById('convertToNumericBtn').addEventListener('click', convertToNumeric);
    document.getElementById('buildChartBtn').addEventListener('click', buildManualChart);
    
    switchMainTab(0);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
else init();