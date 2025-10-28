// src/utils/exportHelpers.js
import { Document, Paragraph, TextRun, HeadingLevel, AlignmentType, Table, TableCell, TableRow, WidthType, BorderStyle } from 'docx';
import PDFDocument from 'pdfkit';
import PptxGenJS from 'pptxgenjs';

export class ExportHelper {
  static generateDOCX(lesson) {
    const children = [];

    // Title
    children.push(
      new Paragraph({
        text: lesson.title || 'Untitled Lesson',
        heading: HeadingLevel.TITLE,
        alignment: AlignmentType.CENTER,
        spacing: { after: 400 }
      })
    );

    // Metadata table
    const metadataRows = [
      new TableRow({
        children: [
          new TableCell({ 
            children: [new Paragraph({ text: "Grade", bold: true })],
            shading: { fill: "F3F4F6" }
          }),
          new TableCell({ 
            children: [new Paragraph({ text: lesson.grade ? lesson.grade.toString() : 'Not specified' })] 
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ 
            children: [new Paragraph({ text: "Subject", bold: true })],
            shading: { fill: "F3F4F6" }
          }),
          new TableCell({ 
            children: [new Paragraph({ text: lesson.subject || 'Not specified' })] 
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ 
            children: [new Paragraph({ text: "Curriculum", bold: true })],
            shading: { fill: "F3F4F6" }
          }),
          new TableCell({ 
            children: [new Paragraph({ text: lesson.curriculum || 'Not specified' })] 
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ 
            children: [new Paragraph({ text: "Duration", bold: true })],
            shading: { fill: "F3F4F6" }
          }),
          new TableCell({ 
            children: [new Paragraph({ text: lesson.duration ? `${lesson.duration} minutes` : 'Not specified' })] 
          })
        ]
      }),
      new TableRow({
        children: [
          new TableCell({ 
            children: [new Paragraph({ text: "Template", bold: true })],
            shading: { fill: "F3F4F6" }
          }),
          new TableCell({ 
            children: [new Paragraph({ text: this.formatTemplateName(lesson.template) })] 
          })
        ]
      })
    ];

    children.push(
      new Table({
        width: { size: 100, type: WidthType.PERCENTAGE },
        rows: metadataRows,
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "D1D5DB" },
        },
      })
    );

    children.push(new Paragraph({ text: "" })); // Empty space

    // Extract and add content from sections
    this.addContentFromSections(children, lesson);
    
    return new Document({
      sections: [{
        properties: {},
        children: children
      }]
    });
  }

  static addContentFromSections(children, lesson) {
    if (!lesson.sections) {
      children.push(
        new Paragraph({
          text: "No content available for this lesson.",
          alignment: AlignmentType.CENTER,
          color: "666666"
        })
      );
      return;
    }

    // Define section display order based on template
    const sectionOrder = this.getSectionOrder(lesson.template);
    
    let hasContent = false;

    for (const sectionName of sectionOrder) {
      const section = lesson.sections[sectionName];
      if (section && section.text && section.text.trim()) {
        hasContent = true;
        
        const displayName = this.formatSectionName(sectionName);
        
        // Add section heading
        children.push(
          new Paragraph({
            text: displayName,
            heading: HeadingLevel.HEADING_1,
            spacing: { before: 400, after: 200 }
          })
        );

        // Add section content
        const paragraphs = section.text.split('\n').filter(p => p.trim());
        paragraphs.forEach(paragraph => {
          if (paragraph.trim()) {
            children.push(
              new Paragraph({
                text: paragraph.trim(),
                spacing: { after: 100 }
              })
            );
          }
        });

        // Add some space after section
        children.push(new Paragraph({ text: "" }));
      }
    }

    // If no sections have content, show message
    if (!hasContent) {
      children.push(
        new Paragraph({
          text: "No content available for this lesson.",
          alignment: AlignmentType.CENTER,
          color: "666666"
        })
      );
    }
  }

  static getSectionOrder(template) {
    // Define logical order for sections based on template type
    const commonSections = [
      'objectives', 'priorKnowledge', 'warmup', 'introduction', 
      'mainActivities', 'activities', 'assessment', 'resources', 
      'differentiation', 'homework', 'notes'
    ];

    const templateSpecific = {
      lesson_plan: [
        'objectives', 'priorKnowledge', 'warmup', 'introduction', 
        'mainActivities', 'assessment', 'resources', 'differentiation', 
        'homework', 'notes'
      ],
      gagne_lesson_plan: [
        'objectives', 'gainAttention', 'informObjectives', 'stimulateRecall',
        'presentContent', 'provideGuidance', 'elicitPerformance', 
        'provideFeedback', 'assessPerformance', 'enhanceRetention',
        'resources', 'differentiation'
      ],
      quiz: [
        'objectives', 'questions', 'answerKey', 'assessment', 
        'resources', 'differentiation'
      ],
      project: [
        'objectives', 'materials', 'procedure', 'timeline',
        'outcomes', 'evaluation', 'resources'
      ],
      debate: [
        'objectives', 'topic', 'forArguments', 'againstArguments',
        'moderatorGuidelines', 'evaluationCriteria', 'timingStructure',
        'resources'
      ],
      unit_plan: [
        'objectives', 'activities', 'assessment', 'resources',
        'differentiation', 'notes'
      ]
    };

    return templateSpecific[template] || commonSections;
  }

  static formatSectionName(sectionName) {
    const nameMap = {
      // Common sections
      objectives: 'Learning Objectives',
      activities: 'Activities',
      assessment: 'Assessment',
      resources: 'Resources & Materials',
      differentiation: 'Differentiation Strategies',
      notes: 'Additional Notes',
      
      // Lesson plan specific
      priorKnowledge: 'Prior Knowledge',
      warmup: 'Warm-up Activity',
      introduction: 'Introduction',
      mainActivities: 'Main Activities',
      homework: 'Homework & Extension',
      
      // Gagné specific
      gainAttention: '1. Gain Attention',
      informObjectives: '2. Inform Objectives',
      stimulateRecall: '3. Stimulate Recall',
      presentContent: '4. Present Content',
      provideGuidance: '5. Provide Guidance',
      elicitPerformance: '6. Elicit Performance',
      provideFeedback: '7. Provide Feedback',
      assessPerformance: '8. Assess Performance',
      enhanceRetention: '9. Enhance Retention',
      
      // Quiz specific
      questions: 'Questions',
      answerKey: 'Answer Key',
      
      // Project specific
      procedure: 'Procedure',
      materials: 'Materials',
      outcomes: 'Expected Outcomes',
      evaluation: 'Evaluation Criteria',
      timeline: 'Timeline',
      
      // Debate specific
      topic: 'Debate Topic',
      forArguments: 'Arguments For',
      againstArguments: 'Arguments Against',
      moderatorGuidelines: 'Moderator Guidelines',
      evaluationCriteria: 'Evaluation Criteria',
      timingStructure: 'Timing Structure'
    };

    return nameMap[sectionName] || this.formatKey(sectionName);
  }

  static formatTemplateName(template) {
    const nameMap = {
      lesson_plan: 'Lesson Plan',
      unit_plan: 'Unit Plan',
      quiz: 'Quiz',
      project: 'Project',
      gagne_lesson_plan: 'Gagné Lesson Plan',
      debate: 'Debate',
      blank: 'Blank Template'
    };
    return nameMap[template] || template;
  }

  static formatKey(key) {
    return key.split(/(?=[A-Z])/).map(word => 
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ');
  }

  static async generatePDF(lesson) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];

        doc.on('data', buffers.push.bind(buffers));
        doc.on('end', () => resolve(Buffer.concat(buffers)));

        // Title
        doc.fontSize(20).font('Helvetica-Bold')
           .text(lesson.title || 'Untitled Lesson', { align: 'center' })
           .moveDown();

        // Metadata
        doc.fontSize(10).font('Helvetica')
           .text(`Grade: ${lesson.grade || 'Not specified'}`, 50, doc.y, { continued: true })
           .text(` | Subject: ${lesson.subject || 'Not specified'}`, { continued: true })
           .text(` | Curriculum: ${lesson.curriculum || 'Not specified'}`)
           .text(`Duration: ${lesson.duration ? `${lesson.duration} minutes` : 'Not specified'}`, 50, doc.y)
           .text(`Template: ${this.formatTemplateName(lesson.template)}`, 50, doc.y)
           .moveDown();

        // Add horizontal line
        doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke()
           .moveDown();

        // Add content from sections
        this.addPDFContentFromSections(doc, lesson);

        doc.end();
      } catch (error) {
        reject(error);
      }
    });
  }

  static addPDFContentFromSections(doc, lesson) {
    if (!lesson.sections) {
      doc.fontSize(12).font('Helvetica')
         .text('No content available for this lesson.', { align: 'center' });
      return;
    }

    const sectionOrder = this.getSectionOrder(lesson.template);
    let hasContent = false;

    for (const sectionName of sectionOrder) {
      const section = lesson.sections[sectionName];
      if (section && section.text && section.text.trim()) {
        hasContent = true;
        
        const displayName = this.formatSectionName(sectionName);
        
        // Add section heading
        doc.fontSize(14).font('Helvetica-Bold')
           .text(displayName, 50, doc.y)
           .moveDown(0.5);

        // Add section content
        doc.fontSize(10).font('Helvetica')
           .text(section.text, 50, doc.y, {
             width: 480,
             align: 'left',
             lineGap: 5
           })
           .moveDown();
      }
    }

    if (!hasContent) {
      doc.fontSize(12).font('Helvetica')
         .text('No content available for this lesson.', { align: 'center' });
    }
  }

  static async generatePPTX(lesson) {
    const pptx = new PptxGenJS();
    
    // Title slide
    const titleSlide = pptx.addSlide();
    titleSlide.addText(lesson.title || 'Untitled Lesson', {
      x: 0.5, y: 1.5, w: 9, h: 1.5,
      fontSize: 24, bold: true, align: "center"
    });
    
    titleSlide.addText(
      `Grade: ${lesson.grade || 'N/A'} | Subject: ${lesson.subject || 'N/A'}\nCurriculum: ${lesson.curriculum || 'N/A'} | Duration: ${lesson.duration || 'N/A'}\nTemplate: ${this.formatTemplateName(lesson.template)}`,
      { x: 0.5, y: 3.0, w: 9, fontSize: 12, align: "center" }
    );

    // Add slides for each section with content
    if (lesson.sections) {
      const sectionOrder = this.getSectionOrder(lesson.template);
      
      for (const sectionName of sectionOrder) {
        const section = lesson.sections[sectionName];
        if (section && section.text && section.text.trim()) {
          const displayName = this.formatSectionName(sectionName);
          
          const contentSlide = pptx.addSlide();
          contentSlide.addText(displayName, {
            x: 0.5, y: 0.5, w: 9, fontSize: 18, bold: true
          });

          // Truncate content if too long for slide
          let contentText = section.text;
          if (contentText.length > 1000) {
            contentText = contentText.substring(0, 1000) + '...';
          }

          contentSlide.addText(contentText, {
            x: 0.5, y: 1.5, w: 9, h: 5,
            fontSize: 12,
            lineSpacing: 1.2
          });
        }
      }
    }

    // If no content, add a placeholder slide
    if (!lesson.sections || Object.keys(lesson.sections).length === 0) {
      const placeholderSlide = pptx.addSlide();
      placeholderSlide.addText("No Content Available", {
        x: 0.5, y: 2.5, w: 9, h: 2,
        fontSize: 18, align: "center", color: "666666"
      });
    }

    return pptx.write('base64').then(base64 => Buffer.from(base64, 'base64'));
  }
}