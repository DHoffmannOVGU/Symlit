# Supplementary Material S1 – Requirements Catalogue for Symlit

Supplement to D. Hoffmann, C. Binder, A. Lüder: *Symlit: Composing Domain Metamodels for Resilience and Sustainability in Production Systems*, CIRP CMS 2027.

## Derivation

76 publications from six areas (clusters A–F below) were read in full. 307 statements on needs and shortcomings were extracted with page references, coded deductively and inductively, and consolidated into 28 **atomic requirements** (one need each). The corpus contained 307 distinct extracted statements. A statement could support more than one atomic requirement (193 statements did), yielding 568 statement–requirement assignments; the statement counts per requirement below count these assignments. Every atomic requirement is supported by at least two independent publications. For reporting in the paper, the atomic requirements are arranged in eight **reporting groups** (R1–R8, Table 1 of the paper) by the tool capability they concern; Table 2 of the paper assesses Symlit v0.1.0 per atomic requirement. Coding was performed by one coder and reviewed by the authors. The coverage assessment states what v0.1.0 provides; the supporting publications establish why a requirement matters, not that Symlit meets it.

## Reporting groups

| Group | Statement | Atomic requirements |
|---|---|---|
| R1 | Domain engineers define lean, task-specific languages with little training | A1, A2, A3 |
| R2 | A concept base such as PPR is reused and extended by new concerns without changing standards or code | A4, A5 |
| R3 | Language and models are defined in one environment and evolve while models are incomplete or inconsistent | A6, A7, A8, A9 |
| R4 | Variants and views of a system coexist with traceable dependencies | A10, A11, A15 |
| R5 | Models are checked against the language and user-defined constraints, with clear feedback | A12, A13, A14 |
| R6 | Models are exchanged in open formats and with engineering standards | A16, A17 |
| R7 | Browser use without installation, teaching, controlled team work, operation on premises | A18, A19, A20, A27, A28 |
| R8 | Programs and agents use standard, metamodel-aware operations; changes are validated and stay under human control | A21, A22, A23, A24, A25, A26 |

## Atomic requirements

Papers / statements: number of supporting publications and extracted statements. Sources refer to the literature list below.

| ID | Requirement | Group | Concern | Papers / statements | Symlit v0.1.0 | Sources |
|---|---|---|---|---|---|---|
| A1 | Domain engineers without metamodeling or programming expertise shall be able to define modeling languages (concepts, attributes, relations) themselves. | R1 | Language definition | 34 / 60 | met | 2, 3, 6–8, 11, 12, 15–17, 23, 25, 33, 37, 38, 40–45, 47–51, 53, 54, 56, 57, 62, 69, 70, 73 |
| A2 | The environment shall be learnable and usable by domain engineers with little training. | R1 | Language definition | 42 / 70 | partly met – learnability indicated by course interviews; onboarding effort not measured | 1, 3, 6–8, 10–13, 15–17, 25, 32, 35, 37, 38, 40, 42, 43, 45, 47–49, 51–56, 58–62, 64, 65, 68–70, 73, 74 |
| A3 | The environment shall support lean, task-specific languages that contain only the concepts an engineering task needs. | R1 | Language definition | 17 / 26 | met | 1, 3, 4, 6, 7, 13, 34–36, 38, 45, 47, 50, 52–54, 60 |
| A4 | New engineering concerns (e.g. resilience, sustainability) shall be addable to a language without changing standards or tool code. | R2 | Language definition | 35 / 52 | met | 2–6, 11, 13, 14, 17–21, 24–34, 36–38, 44, 50, 52–54, 73, 74, 76 |
| A5 | Established domain concept sets (e.g. PPR) shall be reusable as a starting point for new languages. | R2 | Language definition | 8 / 9 | met | 1, 4, 8, 11, 17, 19, 21, 75 |
| A6 | Language definition and modeling shall take place in one environment without a generation or translation step. | R3 | Model use & evolution | 3 / 4 | met | 34, 39, 62 |
| A7 | A language shall remain changeable after models exist, with existing models staying usable (co-evolution). | R3 | Model use & evolution | 19 / 30 | partly met – attributes added to a type must be pulled into existing elements | 6, 9, 15, 25, 27, 30, 34, 36, 38, 39, 41, 45, 46, 48, 54, 65, 69, 71, 76 |
| A8 | Modeling shall be possible example-first, i.e. before or while the language is fully defined. | R3 | Model use & evolution | 4 / 8 | met | 46, 48, 49, 51 |
| A9 | Models shall be allowed to be temporarily inconsistent with their language (configurable inconsistency tolerance). | R3 | Model use & evolution | 2 / 4 | met | 9, 46 |
| A10 | Variants of a system model (e.g. product/PPR variants) shall be representable. | R4 | Model use & evolution | 4 / 5 | met | 4, 5, 15, 53 |
| A11 | One system shall be describable in multiple views that remain related. | R4 | Model use & evolution | 10 / 12 | met | 5, 6, 8, 14, 20, 24, 36, 52, 53, 56 |
| A12 | Models shall be checked automatically for conformance with their language definition. | R5 | Quality assurance | 18 / 27 | partly met – multiplicities not yet checked | 1–3, 5, 9, 12, 13, 17, 35, 36, 39, 43, 46, 49, 56, 57, 72, 74 |
| A13 | Domain-specific constraints beyond the type structure shall be definable without a formal constraint language. | R5 | Quality assurance | 11 / 16 | met | 1–3, 9, 13, 17, 35, 41, 43, 57, 74 |
| A14 | Validation feedback shall be understandable to non-experts. | R5 | Quality assurance | 7 / 11 | met | 3, 17, 43, 49, 56, 58, 74 |
| A15 | Dependencies between model elements, models and variants shall be traceable so that changes can be followed. | R4 | Quality assurance | 12 / 19 | partly met – no trace links across projects | 4, 6, 7, 9, 10, 12, 14, 15, 20, 32, 68, 71 |
| A16 | Models shall be exchangeable with industrial standards (e.g. AutomationML, AAS). | R6 | Interoperability | 19 / 23 | open – no mapping to AutomationML or SysML v2 | 10, 12, 14, 16–19, 21, 22, 26, 27, 29, 31, 32, 35, 36, 68, 74, 76 |
| A17 | Models and languages shall be stored in open formats and integrable into existing tool chains (no vendor lock-in). | R6 | Interoperability | 19 / 24 | met | 5, 8, 10, 11, 17–20, 22, 26, 27, 29, 32, 36, 44, 50, 52, 54, 71 |
| A18 | The environment shall be usable in a web browser without installation. | R7 | Accessibility & education | 15 / 25 | partly met – local installation needed | 16, 18, 35, 36, 39–43, 45, 48, 50, 55, 56, 58 |
| A19 | Several users shall be able to work on languages and models together. | R7 | Accessibility & education | 5 / 5 | open – single user | 39, 42, 43, 48, 56 |
| A20 | The environment shall support teaching modeling and metamodeling. | R7 | Accessibility & education | 10 / 14 | met | 12, 23, 25, 37, 40, 47, 55, 56, 58, 72 |
| A21 | Languages and models shall be accessible programmatically in a machine-readable form. | R8 | Agentic access | 17 / 28 | met | 5, 8, 16, 17, 35–37, 45, 60, 61, 63–67, 73, 75 |
| A22 | AI agents shall be able to discover and invoke modeling operations through a standard protocol (e.g. MCP). | R8 | Agentic access | 4 / 7 | open – MCP planned | 61, 64, 66, 73 |
| A23 | AI agents shall change models through metamodel-aware operations rather than by generating serialized model text. | R8 | Agentic access | 8 / 16 | partly met – external writes not checked against the metamodel | 59, 61, 63–65, 67, 68, 73 |
| A24 | Agent-made changes shall be validated against the language definition. | R8 | Agentic access | 15 / 25 | partly met – conformance checked on request only | 57, 59–61, 63–65, 67–70, 72–74, 76 |
| A25 | AI output shall remain under human review and control. | R8 | Agentic access | 10 / 19 | met | 57, 60, 61, 64, 68–70, 72, 74, 76 |
| A26 | Repetitive modeling work shall be reducible through automation and assistance. | R8 | Agentic access | 18 / 21 | met | 3, 10, 32, 43, 46, 49, 51, 59, 61–64, 68, 69, 71, 73, 75, 76 |
| A27 | Access to languages, models and agent operations shall be controllable (authentication, permissions). | R7 | Security | 4 / 5 | open – single user | 6, 13, 29, 66 |
| A28 | Engineering data shall be processable without leaving the organization (e.g. on-premise or local LLMs). | R7 | Security | 3 / 3 | met in the local edition; the optional assistant uses a cloud service | 63, 64, 69 |

## Literature (76 publications)

**A – PPR and production systems engineering**

[1] Beers, Nabizada, Weigand, Gehlhoff, Fay (2024). Towards an MBSE approach for modeling complex production systems based on industrial standards. *IEEE ETFA 2024*.  
[2] Beers, Nabizada, Weigand, Gehlhoff, Fay (2024). A SysML profile for the standardized description of processes during system development. *IEEE SysCon 2024*.  
[3] Beers, Nabizada, Weigand, Chahine, Gehlhoff, Fay (2026). A domain-specific modeling language for production systems in early engineering phases. *Systems (MDPI)*.  
[4] Beers, Nabizada, Chahine, Gehlhoff, Fay (2026). Modeling product-process-resource variability in early design phases of production systems. *IEEE SysCon 2026*.  
[5] Biffl, Lüder, Gerhard (eds.) (2017). Multi-disciplinary engineering for cyber-physical production systems. *Springer*.  
[6] Biffl, Musil, Musil, Meixner, Lüder, et al. (2021). An Industry 4.0 asset-based coordination artifact for production systems engineering. *IEEE CBI 2021*.  
[7] Binder, Neureiter, Lüder (2021). Towards a domain-specific approach enabling tool-supported model-based systems engineering of complex industrial Internet-of-Things applications. *Systems (MDPI) 9(2)*.  
[8] Binder, Hünecke, Neureiter, Lüder (2023). Towards flexible production systems engineering according to RAMI 4.0 by utilizing PPR notation. *IEEE INDIN 2023*.  
[9] Feldmann, Kernschmidt, Vogel-Heuser, et al. (2019). Managing inter-model inconsistencies in model-based systems engineering: application in automated production systems engineering. *J Syst Softw*.  
[10] Gudder, Hoffmann, Hünecke, Lüder (2025). The IEDT framework: enabling efficient engineering data exchange using AutomationML. *IEEE ETFA 2025*.  
[11] Hoffmann, Gudder, Hünecke, Lüder (2024). Enhancing production system conceptualization with PPR modeling. *IEEE ETFA 2024*.  
[12] Hünecke, Binder, Hoffmann, Hoang, Lüder (2025). Common concept method for citizen modelers in cross-domain engineering. *IEEE ETFA 2025*.  
[13] Kathrein, Meixner, Winkler, Lüder, Biffl (2019). A meta-model for representing consistency as extension to the formal process description. *IEEE ETFA 2019*.  
[14] Lüder, Baumann, Behnert, et al. (2020). Paving pathways for digitalization in engineering: common concepts in engineering chains. *IEEE ETFA 2020*.  
[15] Meixner, Rabiser, Biffl (2019). Towards modeling variability of products, processes and resources in cyber-physical production systems engineering. *SPLC 2019 (ACM)*.  
[16] Meixner, Decker, Marcher, Lüder, Biffl (2020). Towards a domain-specific language for product-process-resource constraints. *IEEE ETFA 2020*.  
[17] Meixner, Rinker, Marcher, Decker, Biffl (2021). A domain-specific language for product-process-resource modeling. *IEEE ETFA 2021*.  
[18] Nabizada, Drath, Gehlhoff, Fay (2026). An AutomationML domain library for the formalized process description. *arXiv 2606.03691*.  
[19] Pfrommer, Schleipen, Beyerer (2013). PPRS: production skills and their relation to product, process, and resource. *IEEE ETFA 2013*.  
[20] Rath, Gierecker, Schüppstuhl (2026). Assembly system modeling with SysML and AutomationML for configuration and reconfiguration. *Procedia CIRP*.  
[21] Schleipen, Drath (2009). Three-view-concept for modeling process or manufacturing plants with AutomationML. *IEEE ETFA 2009*.  
[22] Strakošová, Novák, Kadera (2024). Product-oriented product-process-resource asset network and its representation in AutomationML for AAS. *IEEE ETFA 2024*.  

**B – Industry 5.0, resilience and sustainability**

[23] Barata, Kayser (2023). Industry 5.0 - past, present, and near future. *Procedia Comput Sci*.  
[24] Barrero-Arciniegas, Bataleblu, Rauch, Matt (2026). Sustainable and resilient cyber-physical production systems: a systematic literature review. *J Comput Des Eng 13(5)*.  
[25] Breque, De Nul, Petridis (2021). Industry 5.0: towards a sustainable, human-centric and resilient European industry. *European Commission, Publications Office of the EU*.  
[26] Dickopf, Forte, Weber, Stürmer, et al. (2023). Application of the asset administration shell in the context of engineering data management systems. *IEEE ICE/ITMC 2023*.  
[27] Glišić, Møller, Ramanujan (2024). Digital process passport: a conceptual model for information collection and sharing in sustainable manufacturing. *Procedia CIRP*.  
[28] Hostos, Goepp, Sondi (2025). A systematic literature review of resilience approaches in production systems. *IEEE Trans Eng Manag 72*.  
[29] Kühn, Baumann, Volz, Stojanovic (2025). Digital product passport design supporting the circular economy based on the asset administration shell. *Sustainability (MDPI) 17(3)*.  
[30] Leng, Sha, Wang, Zheng, Zhuang, Liu, Wuest, Mourtzis, Wang (2022). Industry 5.0: prospect and retrospect. *J Manuf Syst 65*.  
[31] Thiele, Khorsandi, Krüger (2019). Energy efficiency optimization using AutomationML modeling and an EnPI methodology. *IEEE ETFA 2019*.  
[32] Wurm, Kasner, Petrovic, Herfs (2026). Designing a system architecture for automated product carbon footprint calculation in production lines. *Procedia CIRP 140*.  
[33] Xu, Lu, Vogel-Heuser, Wang (2021). Industry 4.0 and Industry 5.0 - inception, conception and perception. *J Manuf Syst 61*.  

**C – Metamodeling platforms**

[34] de Lara, Guerra (2010). Deep meta-modelling with MetaDepth. *TOOLS 2010 (Springer)*.  
[35] Fill, Karagiannis (2013). On the conceptualisation of modelling methods using the ADOxx meta modelling platform. *EMISA 8(1)*.  
[36] Karagiannis (2015). Agile modeling method engineering. *PCI 2015 (ACM)*.  
[37] Karagiannis, Buchmann, Utz (2022). The OMiLAB Digital Innovation environment: agile conceptual models to bridge business value with digital and physical twins. *Comput Ind*.  
[38] Kelly, Tolvanen (2008). Domain-specific modeling: enabling full code generation. *Wiley*.  
[39] Maróti, Kecskés, Kereskényi, Broll, et al. (2014). Next generation (meta)modeling: web- and cloud-based collaborative tool infrastructure. *MPM@MODELS 2014, CEUR 1237*.  
[40] Metin, Bork (2025). A reference architecture for the development of GLSP-based web modeling tools. *Softw Syst Model*.  
[41] Muff, Borcard, Fill (2026). MM-AR: a web-based open-source metamodeling platform for spatial conceptual modeling. *Softw Syst Model*.  
[42] Syriani, Vangheluwe, Mannadiar, et al. (2013). AToMPM: a web-based modeling environment. *MODELS 2013 Demos, CEUR 1115*.  
[43] Zweihoff, Naujokat, Steffen (2019). Pyro: generating domain-specific collaborative online modeling environments. *FASE 2019 (Springer)*.  

**D – Lightweight MDE, low-code and adoption**

[44] Bucaioni, Cicchetti, Ciccozzi (2022). Modelling in low-code development: a multi-vocal systematic review. *Softw Syst Model*.  
[45] Di Ruscio, Kolovos, de Lara, Pierantonio, Tisi, Wimmer (2022). Low-code development and model-driven engineering: two sides of the same coin?. *Softw Syst Model 21*.  
[46] Guerra, de Lara (2018). On the quest for flexible modelling. *MODELS 2018 (ACM)*.  
[47] Hutchinson, Whittle, Rouncefield, Kristoffersen (2011). Empirical assessment of MDE in industry. *ICSE 2011 (ACM)*.  
[48] Izquierdo, Cabot, López-Fernández, Sánchez Cuadrado, Guerra, de Lara (2013). Engaging end-users in the collaborative development of domain-specific modelling languages. *CDVE 2013 (Springer)*.  
[49] López-Fernández, Sánchez Cuadrado, Guerra, de Lara (2015). Example-driven meta-model development. *Softw Syst Model 14*.  
[50] Martínez-Lasaca, Díez, Guerra, de Lara (2026). A model and workflow-driven approach for engineering domain-specific low-code platforms and applications. *Softw Syst Model*.  
[51] Sánchez Cuadrado, de Lara, Guerra (2012). Bottom-up meta-modelling: an interactive approach. *MODELS 2012 (Springer)*.  
[52] Verbruggen, Snoeck (2023). Practitioners' experiences with model-driven engineering: a meta-review. *Softw Syst Model*.  
[53] Whittle, Hutchinson, Rouncefield (2014). The state of practice in model-driven engineering. *IEEE Softw 31(3)*.  
[54] Whittle, Hutchinson, Rouncefield, Burden, Heldal (2017). A taxonomy of tool-related issues affecting the adoption of model-driven engineering. *Softw Syst Model 16*.  

**E – MDE education**

[55] Alfonso, Cabot (2025). Teaching low-code development with BESSER. *MODELS-C 2025 (IEEE)*.  
[56] Kienzle, Zschaler, Barnett, Sağlam, et al. (2024). Requirements for modelling tools for teaching. *Softw Syst Model 23(5)*.  
[57] Snoeck, Pastor (2025). Teaching conceptual modelling in the age of LLMs. *Softw Syst Model*.  
[58] Zschaler, Barnett, Boronat, et al. (2026). The MDENet education platform: zero-install directed activities for learning MDE. *Softw Syst Model*.  

**F – Language models, agents and MCP**

[59] Chen, Yang, Chen, Hernández López, Mussbacher, Varró (2023). Automated domain modeling with large language models: a comparative study. *MODELS 2023 (IEEE)*.  
[60] Cibrián, Olivert-Iserte, Álvarez-Rodríguez (2025). An agent-based approach for the automatic generation of valid SysMLv2 models in industrial contexts. *Comput Ind*.  
[61] Cruz et al. (2026). Integrating LLM-based modeling assistants into Capella: experiments and architectural tradeoffs. *IEEE 2026*.  
[62] Di Sipio, Rubei, Di Rocco, Di Ruscio, et al. (2024). On the use of LLMs to support the development of domain-specific modeling languages. *MODELS-C 2024 (ACM)*.  
[63] Hachm, Le Calvar, Bruneliere, Tisi (2025). Towards LLM agents for model-based engineering: a case in transformation selection. *MODELS-C 2025 (IEEE)*.  
[64] Hachm, Le Calvar, Bruneliere, Tisi (2026). A tool selection mechanism for LLM-based model management agents. *Innov Syst Softw Eng*.  
[65] Hell, Fleck, Langer, Bork (2026). Realizing a Model Context Protocol (MCP) server for the Graphical Language Server Platform. *MODELS 2026 (ACM)*.  
[66] Hou, Zhao, Wang, Wang (2025). Model Context Protocol (MCP): landscape, security threats, and future research directions. *ACM TOSEM (arXiv 2503.23278)*.  
[67] Kunze, Fay (2024). Automated generation of AML models for industrial plants using LLM chat applications. *IEEE ETFA 2024*.  
[68] Köhle, Anicic, Runkler (2026). Tool-based agentic AI for asset administration shell generation. *IEEE ICPS 2026*.  
[69] Petrovic, Pan, Zolfaghari, Knoll (2025). LLM-based iterative approach to metamodeling in automotive. *GACLM 2025 (IEEE)*.  
[70] Silva Mercado, Ma, Cabot, Kelsen, Proper (2026). Human-LLM collaborative domain modeling: a human-in-the-loop framework and empirical assessment. *Softw Syst Model*.  
[71] Song et al. (2026). Artificial intelligence for model-based systems engineering: a scoping review. *Comput Ind Eng*.  
[72] Storey, Pastor, Guizzardi, Liddle, et al. (2025). Large language models for conceptual modeling: assessment and application potential. *Data Knowl Eng*.  
[73] Vieira da Silva, Köcher, Gehlhoff (2025). Beyond formal semantics for capabilities and skills: Model Context Protocol in manufacturing. *IEEE ETFA 2025*.  
[74] Westermann, Köcher, Gehlhoff (2025). Automated validation of textual constraints against AutomationML via LLMs and SHACL. *IEEE ETFA 2025*.  
[75] Xia, Shenoy, Jazdi, Weyrich (2023). Towards autonomous system: flexible modular production system enhanced with large language model agents. *IEEE ETFA 2023*.  
[76] Xia, Xiao, Jazdi, Weyrich (2024). Generation of asset administration shell with large language model agents. *IEEE Access 12*.  
