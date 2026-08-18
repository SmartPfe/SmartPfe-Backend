/**
 * 10 Diverse Section-Writing PFE Test Cases for Report Builder Evaluation
 */
const sectionDataset = [
  {
    id: "sec-case-01",
    title: "2.1 Architecture Microservices et Découpage des Services",
    sectionType: "architecture",
    language: "French",
    project: {
      basics: {
        title: "OmniShop: Plateforme E-Commerce Haute Disponibilité Microservices",
        domain: "E-Commerce & Systèmes Distribués",
        language: "French",
      },
      technicalContext: {
        technologies: ["Node.js", "Express", "RabbitMQ", "PostgreSQL", "Docker", "Kubernetes", "Redis"],
        developmentTypes: ["Microservices", "Backend API"],
        methodology: "Scrum",
      },
      description: {
        problemStatement: "Les architectures monolithiques subissent des pannes lors des pics de trafic flash.",
      },
      functionalRequirements: [
        { code: "RF-01", title: "Traitement Asynchrone des Commandes", description: "Mise en file d'attente RabbitMQ." },
        { code: "RF-02", title: "Gestion du Stock en Temps Réel", description: "Verrous distribués Redis." },
      ],
      umlPreparation: {
        classes: [
          { name: "OrderService", description: "Gestion du cycle de vie des commandes." },
          { name: "InventoryService", description: "Réservation atomique des articles." },
        ],
      },
    },
    targetSection: {
      id: "sec-2-1",
      title: "2.1 Architecture Microservices et Découpage des Services",
    },
    ground_truth: {
      expected_technical_concepts: ["microservices", "découpage", "scalabilité", "indépendance", "api gateway", "asynchrone", "rabbitmq", "redis"],
      irrelevant_concepts: ["agriculture", "tracteur", "drone", "médical", "chimiothérapie"],
    },
  },
  {
    id: "sec-case-02",
    title: "3.2 Conception Détaillée et Diagramme de Classes UML",
    sectionType: "design_uml",
    language: "French",
    project: {
      basics: {
        title: "HealthCare Plus: Système de Téléconsultation et Dossier Médical Partagé",
        domain: "Santé Numérique & Télémédecine",
        language: "French",
      },
      technicalContext: {
        technologies: ["Spring Boot", "React", "PostgreSQL", "WebRTC", "Keycloak"],
        methodology: "Scrum",
      },
      description: {
        problemStatement: "Difficulté de centralisation des dossiers patients et sécurisation des téléconsultations.",
      },
      umlPreparation: {
        classes: [
          { name: "Patient", description: "Entité représentant le patient et son historique médical." },
          { name: "Praticien", description: "Médecin avec spécialité et planning de rendez-vous." },
          { name: "Consultation", description: "Séance WebRTC avec ordonnance électronique associée." },
          { name: "DossierMedical", description: "Agrégat des consultations et antécédents médicaux." },
        ],
      },
    },
    targetSection: {
      id: "sec-3-2",
      title: "3.2 Conception Détaillée et Diagramme de Classes UML",
    },
    ground_truth: {
      expected_technical_concepts: ["diagramme de classes", "attributs", "méthodes", "relations", "héritage", "association", "patient", "consultation"],
      irrelevant_concepts: ["voiture", "gps", "entrepôt", "robotique"],
    },
  },
  {
    id: "sec-case-03",
    title: "4.1 Implementation of JWT Authentication and Role-Based Access Control",
    sectionType: "security_implementation",
    language: "English",
    project: {
      basics: {
        title: "PayGuard: High-Throughput Payment Processing with Fraud Detection",
        domain: "Fintech & Cybersecurity",
        language: "English",
      },
      technicalContext: {
        technologies: ["Go", "FastAPI", "PostgreSQL", "Redis", "Kafka", "Docker"],
        methodology: "Scrum",
      },
      description: {
        problemStatement: "Financial transactions require zero-trust token authentication and sub-millisecond fraud scoring.",
      },
      functionalRequirements: [
        { code: "FR-01", title: "OAuth2 & JWT Token Minting", description: "Tokens signed with RS256 with 15min expiry and Redis refresh tokens." },
      ],
    },
    targetSection: {
      id: "sec-4-1",
      title: "4.1 Implementation of JWT Authentication and Role-Based Access Control",
    },
    ground_truth: {
      expected_technical_concepts: ["jwt", "token", "rbac", "authentication", "authorization", "claims", "signature", "refresh token"],
      irrelevant_concepts: ["fertilizer", "soil", "camera proctoring", "telemedicine"],
    },
  },
  {
    id: "sec-case-04",
    title: "1.2 État de l'Art sur les Solutions de Surveillance Réseau et SIEM",
    sectionType: "state_of_the_art",
    language: "French",
    project: {
      basics: {
        title: "CyberShield: SIEM Léger et Détection d'Anomalies Réseau par ML",
        domain: "Cybersécurité & SOC",
        language: "French",
      },
      technicalContext: {
        technologies: ["Python", "Elasticsearch", "Logstash", "Kafka", "Scikit-Learn", "FastAPI", "React"],
        methodology: "Scrum",
      },
      description: {
        problemStatement: "Les PME manquent de solutions SIEM abordables pour détecter les attaques Zero-Day.",
      },
      existingSolutions: [
        { name: "Splunk Enterprise", solvedProblem: "Agrégation universelle de logs", weaknesses: ["Coût prohibitif", "Consommation mémoire extrême"], differentiation: "Architecture légère open-source" },
        { name: "Wazuh", solvedProblem: "EDR et SIEM open source", weaknesses: ["Complexité de configuration"], differentiation: "Intégration d'IA prédictive simplifiée" },
      ],
    },
    targetSection: {
      id: "sec-1-2",
      title: "1.2 État de l'Art sur les Solutions de Surveillance Réseau et SIEM",
    },
    ground_truth: {
      expected_technical_concepts: ["siem", "splunk", "wazuh", "état de l'art", "comparatif", "analyse comparative", "avantages", "limites"],
      irrelevant_concepts: ["agriculture", "e-commerce", "livraison", "scrum"],
    },
  },
  {
    id: "sec-case-05",
    title: "3.1 Real-Time IoT Telemetry Ingestion and InfluxDB Time-Series Modeling",
    sectionType: "data_iot",
    language: "English",
    project: {
      basics: {
        title: "AgriSense: IoT Smart Agriculture Soil & Crop Monitoring System",
        domain: "IoT & Precision Agriculture",
        language: "English",
      },
      technicalContext: {
        technologies: ["ESP32", "LoRaWAN", "MQTT", "Node.js", "InfluxDB", "Grafana"],
        methodology: "Scrum",
      },
      description: {
        problemStatement: "Continuous soil moisture and temperature telemetry requires optimized time-series storage.",
      },
      functionalRequirements: [
        { code: "FR-01", title: "MQTT Ingestion Pipeline", description: "Sensor packets sent every 60s via LoRaWAN gateway." },
      ],
    },
    targetSection: {
      id: "sec-3-1",
      title: "3.1 Real-Time IoT Telemetry Ingestion and InfluxDB Time-Series Modeling",
    },
    ground_truth: {
      expected_technical_concepts: ["iot", "mqtt", "telemetry", "influxdb", "time-series", "sensor", "lorawan", "retention policy"],
      irrelevant_concepts: ["exam proctoring", "payment gateway", "ehr medical"],
    },
  },
  {
    id: "sec-case-06",
    title: "4.3 Pipeline de Traitement NLP et Analyse des Sentiments avec Transformers",
    sectionType: "ai_nlp",
    language: "French",
    project: {
      basics: {
        title: "OmniCare AI: Assistant Support Multilingue et Intelligence Émotionnelle",
        domain: "Intelligence Artificielle & NLP",
        language: "French",
      },
      technicalContext: {
        technologies: ["Python", "PyTorch", "HuggingFace", "FastAPI", "PostgreSQL", "Next.js"],
        methodology: "Scrum",
      },
      description: {
        problemStatement: "Traitement automatique des tickets support avec détection d'urgence et sentiment.",
      },
    },
    targetSection: {
      id: "sec-4-3",
      title: "4.3 Pipeline de Traitement NLP et Analyse des Sentiments avec Transformers",
    },
    ground_truth: {
      expected_technical_concepts: ["nlp", "transformers", "sentiment", "huggingface", "tokenisation", "fine-tuning", "bert", "classification"],
      irrelevant_concepts: ["gps", "camion", "carburant", "blockchain"],
    },
  },
  {
    id: "sec-case-07",
    title: "2.3 Méthodologie Scrum, Rôles et Organisation des Sprints",
    sectionType: "methodology",
    language: "French",
    project: {
      basics: {
        title: "FleetTrack: Solution Intégrée de Gestion de Flotte et Suivi GPS",
        domain: "Logistique & Mobilité",
        language: "French",
      },
      technicalContext: {
        technologies: ["Flutter", "Node.js", "MongoDB", "RabbitMQ", "Leaflet"],
        methodology: "Scrum",
      },
      description: {
        problemStatement: "Optimisation de tournées de livraison et réduction de carburant.",
      },
      actors: [
        { name: "Product Owner", description: "Définit le backlog et valide les user stories." },
        { name: "Scrum Master", description: "Anime les cérémonies et élimine les bloqueurs." },
        { name: "Équipe de Développement", description: "Réalise les sprints." },
      ],
    },
    targetSection: {
      id: "sec-2-3",
      title: "2.3 Méthodologie Scrum, Rôles et Organisation des Sprints",
    },
    ground_truth: {
      expected_technical_concepts: ["scrum", "méthodologie", "sprint", "product owner", "scrum master", "daily meeting", "rétrospective", "backlog"],
      irrelevant_concepts: ["webrtc", "video", "proctoring", "sql injection"],
    },
  },
  {
    id: "sec-case-08",
    title: "5.1 Automated Testing Strategy: Unit, Integration and End-to-End Tests",
    sectionType: "testing_qa",
    language: "English",
    project: {
      basics: {
        title: "SmartLearn: Adaptive E-Learning Platform with Automated Exam Proctoring",
        domain: "EdTech & Computer Vision",
        language: "English",
      },
      technicalContext: {
        technologies: ["React", "FastAPI", "PyTest", "Jest", "Cypress", "Docker"],
        methodology: "Scrum",
      },
      description: {
        problemStatement: "Exam integrity platform requires rigorous automated testing coverage.",
      },
    },
    targetSection: {
      id: "sec-5-1",
      title: "5.1 Automated Testing Strategy: Unit, Integration and End-to-End Tests",
    },
    ground_truth: {
      expected_technical_concepts: ["testing", "unit tests", "integration tests", "end-to-end", "coverage", "jest", "pytest", "cypress"],
      irrelevant_concepts: ["soil sensor", "irrigation", "fleet truck"],
    },
  },
  {
    id: "sec-case-09",
    title: "4.2 Architecture des Smart Contracts et Traçabilité sur Hyperledger Fabric",
    sectionType: "blockchain",
    language: "French",
    project: {
      basics: {
        title: "PharmaChain: Traçabilité des Médicaments et Détection des Contrefaçons",
        domain: "Blockchain & Santé",
        language: "French",
      },
      technicalContext: {
        technologies: ["Hyperledger Fabric", "Go", "Node.js", "React", "Docker"],
        methodology: "Scrum",
      },
      description: {
        problemStatement: "Contrefaçon pharmaceutique dans les chaînes d'approvisionnement mondiales.",
      },
    },
    targetSection: {
      id: "sec-4-2",
      title: "4.2 Architecture des Smart Contracts et Traçabilité sur Hyperledger Fabric",
    },
    ground_truth: {
      expected_technical_concepts: ["blockchain", "hyperledger fabric", "smart contract", "chaincode", "traçabilité", "registre", "ledger", "consensus"],
      irrelevant_concepts: ["sentiment nlp", "proctoring", "exam"],
    },
  },
  {
    id: "sec-case-10",
    title: "5.2 Pipeline CI/CD, Conteneurisation Docker et Déploiement Kubernetes",
    sectionType: "devops_cloud",
    language: "French",
    project: {
      basics: {
        title: "CloudOps: Plateforme GitOps et Déploiement Continu Multi-Cloud",
        domain: "DevOps & Cloud-Native",
        language: "French",
      },
      technicalContext: {
        technologies: ["GitHub Actions", "Docker", "Kubernetes", "Helm", "ArgoCD", "Prometheus"],
        methodology: "Scrum",
      },
      description: {
        problemStatement: "Automatisation du cycle de livraison continue et résilience cloud-native.",
      },
    },
    targetSection: {
      id: "sec-5-2",
      title: "5.2 Pipeline CI/CD, Conteneurisation Docker et Déploiement Kubernetes",
    },
    ground_truth: {
      expected_technical_concepts: ["ci/cd", "pipeline", "docker", "kubernetes", "github actions", "déploiement", "conteneurisation", "argocd"],
      irrelevant_concepts: ["médical", "dossier patient", "agriculture"],
    },
  },
];

module.exports = { sectionDataset };
